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
        /// Stopped; catching the last words and waiting on the final outline.
        case finishing
        case review
    }

    /// Past this the last outline stands.
    static let settleTimeout = Duration.seconds(6)
    /// The final read uploads the recording and runs the slower, more accurate model.
    static let finalTimeout = Duration.seconds(12)

    private(set) var phase = Phase.idle
    private(set) var transcript = ""
    private(set) var rows: [RambleRow] = []
    private(set) var notice: String?
    /// Rows whose full option list shows, by tap.
    private(set) var expanded: Set<Int> = []
    let meter = LevelMeter()

    @ObservationIgnored private let store: LocalStore
    @ObservationIgnored private let index: @MainActor () -> FoodIndex
    @ObservationIgnored private let client: any RambleOutlining
    /// Gemini Live hears the audio and builds the list itself; nil, or a session that fails, listens on the device and
    /// reads the transcript with `client`.
    @ObservationIgnored private let listener: (any RambleLiveConnecting)?
    @ObservationIgnored private var stream: (any RambleLiveStream)?
    /// Consumes the Live session's events in order; it ends after `done` or `failed`.
    @ObservationIgnored private var events: Task<Void, Never>?
    /// The Live session answered every word of this listen, so its list stands without a text read.
    @ObservationIgnored private var answered = false
    @ObservationIgnored private let clock: @Sendable () -> Date
    @ObservationIgnored private let dictation = SpeechDictation()
    @ObservationIgnored private let recorder = RambleRecorder()
    /// The logger's chosen time, where foods said with no day, meal, or time go; nil follows the clock.
    @ObservationIgnored var chosenTime: @MainActor () -> LogTime? = { nil }
    @ObservationIgnored private var outliner: RambleOutliner?
    @ObservationIgnored private var context: RambleContext?
    @ObservationIgnored private var items: [RambleItem] = []
    @ObservationIgnored private var choices: [Int: RambleChoice] = [:]
    /// Advances on every listen and on cancel, so work begun for an earlier one drops its result.
    @ObservationIgnored private(set) var generation = 0
    @ObservationIgnored private var resolution = 0
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
        let base = transcript
        if context == nil { context = await loadContext() }
        guard token == generation, phase == .listening else { return }
        outliner = RambleOutliner(request: { [weak self] text in
            guard let self else { throw CancellationError() }
            return try await client.outline(request(text))
        }, onOutline: { [weak self] _, outline in
            guard let self, token == generation else { return }
            items = outline.items
            resolve()
        })
        let heard: @MainActor (String) -> Void = { [weak self] words in
            guard let self, token == generation, phase == .listening || phase == .finishing else { return }
            transcript = Self.join(base, words)
            outliner?.update(transcript)
        }
        #if DEBUG
        if let script = UserDefaults.standard.string(forKey: Self.scriptArgument) {
            if let audio = UserDefaults.standard.string(forKey: Self.audioArgument) {
                do { try recorder.load(URL(fileURLWithPath: audio)) } catch { RambleOutliner.log.error("No ramble audio: \(String(describing: error))") }
            }
            speak(script, token: token, heard: heard)
            return
        }
        #endif
        if let listener {
            listen(listener, token: token, base: base)
            await startup?.value
            return
        }
        await listenOnDevice(token: token, heard: heard)
    }

    private func listenOnDevice(token: Int, heard: @escaping @MainActor (String) -> Void) async {
        let startup = Task { [dictation, meter, recorder] in
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
        self.startup = startup
        await startup.value
    }

    /// Streams the mic to Gemini Live, whose list follows the speaker with no text reads. The items before this listen
    /// stay ahead of the session's own, which knows only what it hears. A session that fails while listening hands the
    /// rest of the listen to on-device speech and the text reads.
    private func listen(_ listener: any RambleLiveConnecting, token: Int, base: String) {
        let before = items
        answered = false
        let (events, sink) = AsyncStream.makeStream(of: RambleLiveEvent.self)
        let stream = listener.connect(request(transcript)) { sink.yield($0) }
        self.stream = stream
        recorder.stream { stream.send($0) }
        self.events = Task { [weak self] in
            for await event in events {
                guard let self, token == generation else { return }
                switch event {
                case let .transcript(text):
                    transcript = Self.join(base, text)
                case let .outline(outline):
                    items = before + outline.items
                    resolve()
                case let .done(text, outline):
                    transcript = Self.join(base, text)
                    items = before + outline.items
                    answered = true
                    resolve()
                    return
                case let .failed(message):
                    RambleOutliner.log.error("Ramble live session failed: \(message)")
                    self.stream = nil
                    recorder.stream(to: nil)
                    guard phase == .listening else { return }
                    dictation.cancel()
                    let rest = transcript
                    startup = Task { await self.listenOnDevice(token: token) { [weak self] words in
                        guard let self, token == generation, phase == .listening || phase == .finishing else { return }
                        transcript = Self.join(rest, words)
                        outliner?.update(transcript)
                    } }
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

    /// Stops listening, waits for the last words, then for the final read of the recording, falling back to the
    /// outline of exactly the transcript when there is no recording or the final read fails.
    func stop() async {
        guard phase == .listening else { return }
        let stopping = Task { await finish() }
        self.stopping = stopping
        await stopping.value
    }

    /// Every row as it will be logged: listening stops and the final read lands, and the latest resolution with it.
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
        await dictation.finish()
        guard token == generation else { return }
        await finishLive()
        guard token == generation else { return }
        let final = await finalRead()
        guard token == generation else { return }
        if let final {
            // A live read still in flight would otherwise land after this one and replace it.
            outliner?.stop()
            items = final.items
            await resolve()?.value
        } else if !answered {
            let outline = await outliner?.settle(transcript, timeout: Self.settleTimeout)
            guard token == generation else { return }
            if let outline {
                items = outline.items
                await resolve()?.value
            } else if outliner?.off == true {
                notice = "The ramble couldn't be read. The foods so far stay."
            }
        }
        guard token == generation else { return }
        outliner?.stop()
        phase = .review
    }

    /// Ends the Live session's audio and waits for its answer to every word it heard, up to `settleTimeout`.
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

    private func finalRead() async -> RambleOutline? {
        guard outliner?.off != true, let wav = recorder.wav() else { return nil }
        var body = request(transcript)
        body.audio = RambleRequest.Audio(data: wav.base64EncodedString())
        let read = Task { [client] in try await client.outline(body) }
        let timeout = Task {
            try? await Task.sleep(for: Self.finalTimeout)
            read.cancel()
        }
        defer { timeout.cancel() }
        do {
            return try await read.value
        } catch {
            RambleOutliner.log.error("Ramble final read failed: \(String(describing: error))")
            return nil
        }
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
        // The detail was opened on `row`; a final read may have put another food at its position since, and a measure
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
        transcript = ""
        rows = []
        items = []
        recorder.reset()
        choices = [:]
        expanded = []
        notice = nil
    }

    private func end(_ token: Int, notice: String) {
        guard token == generation else { return }
        self.notice = notice
        outliner?.stop()
        phase = rows.isEmpty && transcript.isEmpty ? .idle : .review
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

    private func request(_ transcript: String) -> RambleRequest {
        let now = clock()
        let minute = now.minuteOfDay()
        let shown = rows.compactMap { row -> RambleRequest.Shown? in
            guard case let .food(food) = row.content, !food.options.isEmpty else { return nil }
            let count = showsAllOptions(row) ? RambleResolver.optionLimit : RambleResolver.collapsedOptions
            return RambleRequest.Shown(item: row.id, options: food.options.prefix(count).map { String($0.portion.food.displayName.prefix(200)) })
        }
        return RambleRequest(
            transcript: transcript, today: CalendarDay(now), time: String(format: "%02d:%02d", minute / 60, minute % 60),
            meals: context?.meals ?? [], usual: context?.usual ?? [], shown: shown
        )
    }

    /// Resolves the latest items off the main actor; an older resolution finishing late is dropped.
    @discardableResult
    private func resolve() -> Task<Void, Never>? {
        resolution += 1
        let token = resolution
        let now = clock()
        let fallback = chosenTime().map { ($0.day, $0.hour * 60) } ?? (CalendarDay(now), now.minuteOfDay())
        let resolver = RambleResolver(index: index(), context: context ?? RambleContext(), today: CalendarDay(now), fallback: fallback)
        let items = items, previous = rows, choices = choices
        let task = Task { [weak self] in
            let resolved = await Task.detached { try? resolver.rows(items, previous: previous, choices: choices) }.value
            guard let self, let resolved, token == resolution, !Task.isCancelled else { return }
            if resolved != rows { rows = resolved }
        }
        resolving = task
        return task
    }

    private static func join(_ base: String, _ words: String) -> String {
        guard !base.isEmpty else { return words }
        return words.isEmpty ? base : "\(base) \(words)"
    }

    #if DEBUG
    /// DEBUG-only: `-RambleTranscript "…"` arrives a word at a time like live speech, through the same outliner, so the
    /// simulator, which has no microphone, drives the whole pipeline. The capture keeps listening until stopped.
    static let scriptArgument = "RambleTranscript"
    /// `-RambleAudio <path>` with it: the recording the final read sends.
    static let audioArgument = "RambleAudio"

    /// `-RambleAudio <path>` alone, with Gemini Live: the file plays into the session in real time in place of the mic.
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
                    meter.set(.random(in: 0.08 ... 0.5))
                    recorder.write(buffer)
                }
            } catch {
                RambleOutliner.log.error("No ramble audio: \(String(describing: error))")
            }
            meter.set(0)
        }
    }

    private func speak(_ script: String, token: Int, heard: @escaping @MainActor (String) -> Void) {
        let words = script.split(separator: " ")
        self.script = Task { [weak self] in
            for count in 1 ... max(words.count, 1) {
                try? await Task.sleep(for: .milliseconds(160))
                guard let self, !Task.isCancelled, token == generation else { return }
                meter.set(.random(in: 0.08 ... 0.5))
                heard(words.prefix(count).joined(separator: " "))
            }
            self?.meter.set(0)
        }
    }
    #endif
}
