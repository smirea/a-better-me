import AVFoundation
import Foundation
import Observation

/// One Ramble in the logger: the mic, the transcript, the model's outline kept current while it is spoken, and the
/// rows resolved from it. Nothing is logged until `LoggerSession.logRamble`. Talking again after a stop continues the
/// same transcript, so the model keeps reading the whole ramble and rows keep their positions.
@MainActor @Observable
final class RambleCapture {
    enum Phase: Equatable, Sendable {
        case idle
        case listening
        /// Stopped; catching the last words and their outline. The rows can be edited and added meanwhile.
        case finishing
        case review
    }

    /// Past this the last outline stands.
    static let settleTimeout = Duration.seconds(6)

    private(set) var phase = Phase.idle
    /// What the speaker said this ramble, every listen included.
    private(set) var heard = RambleHeard() {
        didSet {
            guard heard != oldValue else { return }
            words = RambleWords(heard)
            respan()
        }
    }
    private(set) var rows: [RambleRow] = [] {
        didSet { respan(leaving: oldValue) }
    }
    /// The transcript as words, and the words each row was parsed from, by `RambleRow.key`.
    private(set) var words = RambleWords()
    private(set) var spans: [Int: Range<Int>] = [:]
    /// The words of rows that left, because the speaker took them back or the owner removed them.
    private(set) var struck: Set<Int> = []
    /// Where each row's food was first said: a row taken back strikes these, not the words that took it back.
    @ObservationIgnored private var named: [Int: Range<Int>] = [:]
    private(set) var notice: String?
    /// Rows whose full option list shows, by tap.
    private(set) var expanded: Set<Int> = []
    let meter = LevelMeter()

    var transcript: String { heard.text }

    @ObservationIgnored private let store: LocalStore
    @ObservationIgnored private let index: @MainActor () -> FoodIndex
    @ObservationIgnored private let client: any RambleOutlining
    /// The server transcribes the audio and keeps the outline current itself; nil, or a session that fails, listens on
    /// the device and reads the transcript with `client`.
    @ObservationIgnored private let listener: (any RambleLiveConnecting)?
    @ObservationIgnored private var stream: (any RambleLiveStream)?
    /// Consumes the live session's events in order; it ends after `done` or `failed`.
    @ObservationIgnored private var events: Task<Void, Never>?
    /// The options last sent to the live session.
    @ObservationIgnored private var shown: [RambleRequest.Shown] = []
    @ObservationIgnored private let clock: @Sendable () -> Date
    @ObservationIgnored private let dictation = SpeechDictation()
    @ObservationIgnored private let recorder = RambleRecorder()
    /// The logger's chosen time, where foods said with no day, meal, or time go; nil follows the clock.
    @ObservationIgnored var chosenTime: @MainActor () -> LogTime? = { nil }
    @ObservationIgnored private var outliner: RambleOutliner?
    @ObservationIgnored private var context: RambleContext?
    /// The owner's choices and expanded rows are by position, so they move with their items when an answer numbers the
    /// items differently: a read that hears a food the last one missed must not bring back a row removed meanwhile.
    @ObservationIgnored private var items: [RambleItem] = [] {
        didSet {
            guard !choices.isEmpty || !expanded.isEmpty else { return }
            let aligned = RambleAlignment.align(oldValue.map(\.identity), items.map(\.identity)).filter(\.value.same)
            let moved = Dictionary(uniqueKeysWithValues: aligned.map { ($0.value.old, $0.key) })
            choices = Dictionary(uniqueKeysWithValues: choices.compactMap { old, choice in moved[old].map { ($0, choice) } })
            let open = Set(expanded.compactMap { moved[$0] })
            if open != expanded { expanded = open }
        }
    }
    @ObservationIgnored private var choices: [Int: RambleChoice] = [:]
    /// Advances on every listen and on cancel, so work begun for an earlier one drops its result.
    @ObservationIgnored private(set) var generation = 0
    @ObservationIgnored private var resolution = 0
    @ObservationIgnored private var keys = 0
    @ObservationIgnored private var script: Task<Void, Never>?
    @ObservationIgnored private var startup: Task<Void, Never>?
    @ObservationIgnored private var stopping: Task<Void, Never>?
    @ObservationIgnored private var resolving: Task<Void, Never>?

    init(
        store: LocalStore, index: @escaping @MainActor () -> FoodIndex, client: any RambleOutlining,
        listener: (any RambleLiveConnecting)? = nil, clock: @escaping @Sendable () -> Date = { .now }
    ) {
        self.store = store
        self.index = index
        self.client = client
        self.listener = listener
        self.clock = clock
    }

    var planned: [RamblePlanned] { rows.flatMap(\.planned) }
    var isEmpty: Bool { rows.isEmpty }

    func showsAllOptions(_ row: RambleRow) -> Bool {
        guard case let .food(food) = row.content else { return false }
        return food.showsOptions || expanded.contains(row.id)
    }

    func start() async {
        guard phase == .idle || phase == .review else { return }
        // A startup still awaiting assets or permission finishes, and stops itself, before this one installs the mic;
        // closing the logger meanwhile cancels this one too.
        let before = generation
        await startup?.value
        guard generation == before, phase == .idle || phase == .review else { return }
        generation += 1
        let token = generation
        phase = .listening
        notice = nil
        meter.set(0)
        if context == nil { context = await loadContext() }
        guard token == generation, phase == .listening else { return }
        #if DEBUG
        if let script = UserDefaults.standard.string(forKey: Self.scriptArgument) {
            speak(script, token: token, onText: readTranscript(token: token))
            return
        }
        #endif
        if let listener {
            listen(listener, token: token)
            await startup?.value
            return
        }
        listenOnDevice(token: token)
        await startup?.value
    }

    /// Reads the transcript with `client` as it grows; the closure takes the words heard since this listen began.
    private func readTranscript(token: Int) -> @MainActor (String) -> Void {
        let base = heard.committed
        outliner = RambleOutliner(request: { [weak self] text in
            guard let self else { throw CancellationError() }
            return try await client.outline(request(text))
        }, onOutline: { [weak self] _, outline in
            guard let self, token == generation else { return }
            items = outline.items
            resolve()
        })
        return { [weak self] words in
            guard let self, token == generation, phase == .listening || phase == .finishing else { return }
            heard = RambleHeard(committed: Self.join(base, words))
            outliner?.update(transcript)
        }
    }

    /// On-device speech-to-text, with the outline read from the transcript by `client`.
    private func listenOnDevice(token: Int) {
        let heard = readTranscript(token: token)
        startup = Task { [dictation, meter, recorder] in
            do {
                try await dictation.start(meter: meter, recorder: recorder, onText: heard)
                // Stopped, cancelled, or closed while starting: the mic must not stay on.
                if token != generation || phase != .listening { dictation.cancel() }
            } catch SpeechDictation.Failure.denied {
                end(token, notice: "The microphone is off. Turn it on in Settings to ramble.")
            } catch {
                RambleOutliner.log.error("Dictation could not start: \(String(describing: error))")
                end(token, notice: "Dictation isn't available right now.")
            }
        }
    }

    /// Streams the mic to the live session, which transcribes it and reads the whole ramble as it grows. A session that
    /// fails while listening hands the rest of the listen to on-device speech and the text reads.
    private func listen(_ listener: any RambleLiveConnecting, token: Int) {
        shown = currentShown()
        let (events, sink) = AsyncStream.makeStream(of: RambleLiveEvent.self)
        let stream = listener.connect(request(heard.committed)) { sink.yield($0) }
        self.stream = stream
        recorder.stream { stream.send($0) }
        self.events = Task { [weak self] in
            for await event in events {
                guard let self, token == generation else { return }
                switch event {
                case let .heard(words):
                    heard = words
                case let .outline(outline):
                    guard outline.items != items else { continue }
                    items = outline.items
                    resolve()
                case let .done(text, outline):
                    heard = RambleHeard(committed: text)
                    items = outline.items
                    resolve()
                    return
                case let .failed(message):
                    RambleOutliner.log.error("Ramble live session failed: \(message)")
                    self.stream = nil
                    recorder.stream(to: nil)
                    heard = RambleHeard(committed: heard.text)
                    guard phase == .listening else {
                        // Stopped: the last words still get one read, through the text route.
                        if let outline = try? await client.outline(request(heard.text)), token == generation {
                            items = outline.items
                        } else {
                            notice = "The last words couldn't be read. The foods so far stay."
                        }
                        return
                    }
                    dictation.cancel()
                    listenOnDevice(token: token)
                    return
                }
            }
        }
        #if DEBUG
        if let audio = UserDefaults.standard.string(forKey: Self.audioArgument) {
            replay(URL(fileURLWithPath: audio), token: token)
            return
        }
        #endif
        startup = Task { [dictation, meter, recorder] in
            do {
                try await dictation.start(meter: meter, recorder: recorder, onText: nil)
                if token != generation || phase != .listening { dictation.cancel() }
            } catch SpeechDictation.Failure.denied {
                stream.cancel()
                end(token, notice: "The microphone is off. Turn it on in Settings to ramble.")
            } catch {
                RambleOutliner.log.error("The mic could not start: \(String(describing: error))")
                stream.cancel()
                end(token, notice: "Dictation isn't available right now.")
            }
        }
    }

    /// Stops listening and waits for the outline of the last words.
    func stop() async {
        guard phase == .listening else { return }
        let stopping = Task { await finish() }
        self.stopping = stopping
        await stopping.value
    }

    /// Every row as it will be logged: listening stops and the last outline lands, and the latest resolution with it.
    func settled() async {
        if phase == .listening { await stop() } else if phase == .finishing { await stopping?.value }
        while let task = resolving {
            await task.value
            if resolving == task { break }
        }
    }

    private func finish() async {
        let token = generation
        phase = .finishing
        meter.set(0)
        script?.cancel()
        let stopped = ContinuousClock.now
        if stream != nil {
            dictation.cancel()
            await finishLive()
        } else {
            await dictation.finish()
            guard token == generation else { return }
            let outline = await outliner?.settle(transcript, timeout: Self.settleTimeout)
            guard token == generation else { return }
            if let outline {
                items = outline.items
            } else if outliner?.off == true {
                notice = "The ramble couldn't be read. The foods so far stay."
            }
        }
        guard token == generation else { return }
        await resolve()?.value
        RambleOutliner.log.info("Ramble stop: settled after \(ContinuousClock.now - stopped)")
        guard token == generation else { return }
        outliner?.stop()
        phase = .review
    }

    /// Ends the live session's audio and waits for its outline of every word it heard, up to `settleTimeout`.
    private func finishLive() async {
        recorder.stream(to: nil)
        guard let stream, let events else { return }
        stream.stop()
        let timeout = Task {
            try? await Task.sleep(for: Self.settleTimeout)
            events.cancel()
        }
        await events.value
        timeout.cancel()
        stream.cancel()
        self.stream = nil
        self.events = nil
    }

    /// Ends the capture without logging, when the logger closes.
    func cancel() {
        generation += 1
        script?.cancel()
        dictation.cancel()
        recorder.stream(to: nil)
        stream?.cancel()
        stream = nil
        events?.cancel()
        outliner?.stop()
        resolving?.cancel()
    }

    func pick(_ option: FoodSearchResult, in row: RambleRow) {
        choices[row.id] = RambleChoice(name: row.item.identity, option: option.key)
        expanded.remove(row.id)
        resolve()
    }

    /// False when the row no longer holds the food `row` showed, and nothing changed.
    @discardableResult
    func setServing(_ serving: Serving, of row: RambleRow) -> Bool {
        // The detail was opened on `row`; a later read may have put another food at its position since, and a measure
        // never moves to a food it was not made for.
        guard holds(row), let index = rows.firstIndex(where: { $0.id == row.id }), case var .food(food) = rows[index].content
        else { return false }
        var choice = choices[row.id].flatMap { $0.name == row.item.identity ? $0 : nil } ?? RambleChoice(name: row.item.identity)
        choice.option = food.key
        choice.serving = serving
        choices[row.id] = choice
        // Applied to the row now as well, so a log right after it never waits on a resolution to see it.
        food.pick.portion.serving = serving
        rows[index].content = .food(food)
        resolve()
        return true
    }

    /// Whether the row at `row`'s position is still the same item and food, as when a detail opened on it.
    func holds(_ row: RambleRow) -> Bool {
        guard let current = rows.first(where: { $0.id == row.id }), current.item.identity == row.item.identity,
              case let .food(food) = current.content, case let .food(opened) = row.content
        else { return false }
        return food.key == opened.key
    }

    /// The logger's time changed, so foods placed by it move.
    func replace() {
        guard !items.isEmpty else { return }
        resolve()
    }

    func remove(_ row: RambleRow) {
        choices[row.id] = RambleChoice(name: row.item.identity, removed: true)
        rows.removeAll { $0.id == row.id }
        // A resolution already running read the choices before this one; resolving again drops its answer.
        resolve()
    }

    func toggleOptions(_ row: RambleRow) {
        if expanded.remove(row.id) == nil { expanded.insert(row.id) }
    }

    /// After the rows are logged, so a new ramble starts empty.
    func reset() {
        cancel()
        phase = .idle
        heard = RambleHeard()
        rows = []
        items = []
        choices = [:]
        expanded = []
        shown = []
        struck = []
        named = [:]
        notice = nil
    }

    private func respan(leaving old: [RambleRow] = []) {
        var next: [Int: Range<Int>] = [:]
        for row in rows {
            if let span = words.span(of: row.item.said) { next[row.key] = span }
        }
        for (key, span) in next where named[key] == nil { named[key] = span }
        let kept = Set(rows.map(\.key))
        let gone = old.filter { !kept.contains($0.key) }.compactMap { named[$0.key] }.flatMap { $0 }
        if !gone.isEmpty { struck.formUnion(gone) }
        if next != spans { spans = next }
    }

    private func end(_ token: Int, notice: String) {
        guard token == generation else { return }
        self.notice = notice
        outliner?.stop()
        phase = rows.isEmpty && heard.isEmpty ? .idle : .review
    }

    private func loadContext() async -> RambleContext {
        let today = CalendarDay(clock())
        let start = today.adding(days: -(RambleContext.usualDays - 1))
        do {
            let entries = try await store.database.pool.read(FoodEntry.between(start, today).fetch)
            // Grouping and ranking 60 days of entries stays off the main actor.
            return await Task.detached { RambleContext(entries: entries, today: today) }.value
        } catch {
            RambleOutliner.log.error("Ramble could not read the log: \(String(describing: error))")
            return RambleContext()
        }
    }

    private func currentShown() -> [RambleRequest.Shown] {
        rows.compactMap { row -> RambleRequest.Shown? in
            guard case let .food(food) = row.content, !food.options.isEmpty else { return nil }
            let count = expanded.contains(row.id) ? RambleResolver.optionLimit : RambleResolver.collapsedOptions
            return RambleRequest.Shown(item: row.id, options: food.options.prefix(count).map { String($0.portion.food.displayName.prefix(200)) })
        }
    }

    private func request(_ transcript: String) -> RambleRequest {
        let now = clock()
        let minute = now.minuteOfDay()
        return RambleRequest(
            transcript: transcript, today: CalendarDay(now), time: String(format: "%02d:%02d", minute / 60, minute % 60),
            meals: context?.meals ?? [], usual: context?.usual ?? [], shown: currentShown()
        )
    }

    /// Shows the latest items at once as the words they were parsed from, then their search results off the main actor.
    /// An older resolution finishing late is dropped.
    @discardableResult
    private func resolve() -> Task<Void, Never>? {
        resolution += 1
        let token = resolution
        let now = clock()
        let fallback = chosenTime().map { ($0.day, $0.hour * 60) } ?? (CalendarDay(now), now.minuteOfDay())
        let resolver = RambleResolver(index: index(), context: context ?? RambleContext(), today: CalendarDay(now), fallback: fallback)
        let items = items, choices = choices
        if let parsed = try? resolver.rows(items, previous: rows.lined(up: items), choices: choices, search: false) {
            let keyed = parsed.keyed(after: rows, next: &keys)
            if keyed != rows { rows = keyed }
        }
        let previous = rows
        let task = Task { [weak self] in
            let resolved = await Task.detached { try? resolver.rows(items, previous: previous, choices: choices) }.value
            guard let self, let resolved, token == resolution, !Task.isCancelled else { return }
            let keyed = resolved.keyed(after: rows, next: &keys)
            if keyed != rows { rows = keyed }
            sendShown()
        }
        resolving = task
        return task
    }

    /// The live session reads picks against the options on screen, so it hears of every change to them.
    private func sendShown() {
        guard let stream else { return }
        let now = currentShown()
        guard now != shown else { return }
        shown = now
        stream.show(now)
    }

    private static func join(_ base: String, _ words: String) -> String {
        guard !base.isEmpty else { return words }
        return words.isEmpty ? base : "\(base) \(words)"
    }

    #if DEBUG
    /// DEBUG-only: `-RambleTranscript "…"` arrives a word at a time like live speech, through on-device reads, so the
    /// simulator, which has no microphone, drives the text pipeline. The capture keeps listening until stopped.
    static let scriptArgument = "RambleTranscript"
    /// `-RambleAudio <path>`: the file plays into the live session in real time in place of the mic.
    static let audioArgument = "RambleAudio"

    private func replay(_ url: URL, token: Int) {
        script = Task { [weak self, recorder, meter] in
            do {
                let file = try AVAudioFile(forReading: url)
                try recorder.begin(file.processingFormat)
                let frames = AVAudioFrameCount(file.processingFormat.sampleRate / 10)
                while file.framePosition < file.length {
                    try await Task.sleep(for: .milliseconds(100))
                    guard let self, token == generation, !Task.isCancelled else { return }
                    let buffer = AVAudioPCMBuffer(copying: try file.read(frameCount: frames))
                    meter.set(Self.peak(buffer))
                    recorder.write(buffer)
                }
            } catch {
                RambleOutliner.log.error("No ramble audio: \(String(describing: error))")
            }
            meter.set(0)
        }
    }

    private nonisolated static func peak(_ buffer: AVAudioPCMBuffer) -> Float {
        guard let channel = buffer.floatChannelData?[0] else { return .random(in: 0.08 ... 0.5) }
        var peak: Float = 0
        for index in 0 ..< Int(buffer.frameLength) { peak = max(peak, abs(channel[index])) }
        return peak
    }

    private func speak(_ script: String, token: Int, onText: @escaping @MainActor (String) -> Void) {
        let words = script.split(separator: " ")
        self.script = Task { [weak self] in
            for count in 1 ... max(words.count, 1) {
                try? await Task.sleep(for: .milliseconds(160))
                guard let self, !Task.isCancelled, token == generation else { return }
                meter.set(.random(in: 0.08 ... 0.5))
                onText(words.prefix(count).joined(separator: " "))
            }
            self?.meter.set(0)
        }
    }
    #endif
}
