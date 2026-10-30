import AVFoundation
import Foundation
import Observation
import os

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

    nonisolated static let log = Logger(subsystem: "com.stefan.a-better-me", category: "ramble")

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
        didSet {
            respan(leaving: oldValue)
            holdParsed(after: oldValue)
        }
    }
    /// Rows, by key, still showing what was said before their match: a new row while the speaker talks, for
    /// `parsedFor`, and a row searching again for a renamed food. The parse and the match read as two steps, and the
    /// totals leave the row out until its match shows.
    private(set) var parsing: Set<Int> = []
    /// `parsing`, until a quarter second after its match shows, so the totals roll once the match is readable.
    private(set) var uncounted: Set<Int> = []
    /// Names the online search is looking for, whose rows say so.
    private(set) var searchingOnline: Set<String> = []
    /// Advances when the owner changes a row from its detail or its menu, with that row's key, so the row lights up as
    /// the list shows again.
    private(set) var edited = 0
    @ObservationIgnored private(set) var editedKey: Int?
    /// The transcript as words, and the words each row was parsed from, by `RambleRow.key`.
    private(set) var words = RambleWords()
    private(set) var spans: [Int: Range<Int>] = [:]
    /// The words of rows that left, because the speaker took them back or the owner removed them.
    private(set) var struck: Set<Int> = []
    /// Where each row's food was first said: a row taken back strikes these, not the words that took it back.
    @ObservationIgnored private var named: [Int: Range<Int>] = [:]
    /// The struck words of each food that left, by name: the model sometimes drops a food mid-sentence and brings it back
    /// a read later, and then its words are not taken back.
    @ObservationIgnored private var gone: [String: Range<Int>] = [:]
    private(set) var notice: String?
    let meter = LevelMeter()

    var transcript: String { heard.text }

    @ObservationIgnored private let store: LocalStore
    @ObservationIgnored private let index: @MainActor () -> FoodIndex
    /// The server transcribes the audio and keeps the outline current.
    @ObservationIgnored private let listener: any RambleLiveConnecting
    @ObservationIgnored private var stream: (any RambleLiveStream)?
    /// Consumes the live session's events in order; it ends after `done` or `failed`.
    @ObservationIgnored private var events: Task<Void, Never>?
    /// The options last sent to the live session.
    @ObservationIgnored private var shown: [RambleRequest.Shown] = []
    @ObservationIgnored private let clock: @Sendable () -> Date
    @ObservationIgnored private let mic = RambleMic()
    @ObservationIgnored private let recorder = RambleRecorder()
    /// The logger's chosen time, where foods said with no day, meal, or time go; nil follows the clock.
    @ObservationIgnored var chosenTime: @MainActor () -> LogTime? = { nil }
    /// The logger's search with Open Food Facts, for a name the bundled catalog and the owner's foods do not know: most of
    /// those are branded or composite foods ("Diet Coke", "pad thai"). Asked once per name.
    @ObservationIgnored var searchOnline: @MainActor (String) async -> [FoodSearchResult] = { _ in [] }
    @ObservationIgnored private var online: [String: [FoodSearchResult]] = [:]
    /// Names the local search did not know, asked online, which the rows show as their own stage.
    private(set) var askedOnline: Set<String> = []
    @ObservationIgnored private var context: RambleContext?
    /// The owner's choices are by position, so they move with their items when an answer numbers the
    /// items differently: a read that hears a food the last one missed must not bring back a row removed meanwhile.
    @ObservationIgnored private var items: [RambleItem] = [] {
        didSet {
            guard !choices.isEmpty else { return }
            let aligned = RambleAlignment.align(oldValue.map(\.identity), items.map(\.identity)).filter(\.value.same)
            let moved = Dictionary(uniqueKeysWithValues: aligned.map { ($0.value.old, $0.key) })
            choices = Dictionary(uniqueKeysWithValues: choices.compactMap { old, choice in moved[old].map { ($0, choice) } })
        }
    }
    @ObservationIgnored private var choices: [Int: RambleChoice] = [:]
    /// The live session's last outline, for `held`.
    @ObservationIgnored private var lastOutline: [RambleItem] = []
    /// Advances on every listen and on cancel, so work begun for an earlier one drops its result.
    @ObservationIgnored private(set) var generation = 0
    @ObservationIgnored private var resolution = 0
    @ObservationIgnored private var keys = 0
    @ObservationIgnored private var replaying: Task<Void, Never>?
    @ObservationIgnored private var startup: Task<Void, Never>?
    @ObservationIgnored private var stopping: Task<Void, Never>?
    @ObservationIgnored private var resolving: Task<Void, Never>?

    init(
        store: LocalStore, index: @escaping @MainActor () -> FoodIndex, listener: any RambleLiveConnecting,
        clock: @escaping @Sendable () -> Date = { .now }
    ) {
        self.store = store
        self.index = index
        self.listener = listener
        self.clock = clock
    }

    var planned: [RamblePlanned] { rows.flatMap(\.planned) }
    /// What the summary counts: the rows whose match shows.
    var shownPlanned: [RamblePlanned] { rows.filter { !uncounted.contains($0.key) }.flatMap(\.planned) }

    /// Foods said but found neither locally nor online, once their parse and the online search are done.
    var notFound: Int {
        rows.count { $0.content == .unmatched && !parsing.contains($0.key) && !searchingOnline.contains($0.item.name.lowercased()) }
    }

    /// The words land 0.55 s after the row appears, and what was said shows for a second after that.
    static let parsedFor = Duration.milliseconds(1550)
    var isEmpty: Bool { rows.isEmpty }

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
        listen(token: token)
        await startup?.value
    }

    /// Streams the mic to the live session, which transcribes it and reads the whole ramble as it grows.
    private func listen(token: Int) {
        shown = currentShown()
        lastOutline = items
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
                    let shown = Self.held(outline.items, showing: items, last: lastOutline)
                    lastOutline = outline.items
                    guard shown != items else { continue }
                    items = shown
                    resolve()
                case let .done(text, outline):
                    heard = RambleHeard(committed: text)
                    items = outline.items
                    resolve()
                    return
                case let .failed(message):
                    Self.log.error("Ramble live session failed: \(message)")
                    self.stream = nil
                    recorder.stream(to: nil)
                    mic.stop()
                    replaying?.cancel()
                    heard = RambleHeard(committed: heard.text)
                    end(token, notice: "The ramble stopped listening. The foods so far stay.")
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
        startup = Task { [mic, meter, recorder] in
            do {
                try await mic.start(meter: meter, recorder: recorder)
                // Stopped, cancelled, or closed while starting: the mic must not stay on.
                if token != generation || phase != .listening { mic.stop() }
            } catch RambleMic.Failure.denied {
                stream.cancel()
                end(token, notice: "The microphone is off. Turn it on in Settings to ramble.")
            } catch {
                Self.log.error("The mic could not start: \(String(describing: error))")
                stream.cancel()
                end(token, notice: "The microphone isn't available right now.")
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
        replaying?.cancel()
        let stopped = ContinuousClock.now
        mic.stop()
        await finishLive()
        guard token == generation else { return }
        await resolve()?.value
        Self.log.info("Ramble stop: settled after \(ContinuousClock.now - stopped)")
        guard token == generation, phase == .finishing else { return }
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
        replaying?.cancel()
        mic.stop()
        recorder.stream(to: nil)
        stream?.cancel()
        stream = nil
        events?.cancel()
        resolving?.cancel()
    }

    func pick(_ option: FoodSearchResult, in row: RambleRow) {
        choices[row.id] = RambleChoice(name: row.item.identity, option: option.key)
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
        editedKey = row.key
        edited += 1
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
        // The owner took the whole row back: every word of it, corrections included, is struck.
        if let span = spans[row.key] { struck.formUnion(span) }
        rows.removeAll { $0.id == row.id }
        // A resolution already running read the choices before this one; resolving again drops its answer.
        resolve()
    }

    /// After the rows are logged, so a new ramble starts empty.
    func reset() {
        cancel()
        phase = .idle
        heard = RambleHeard()
        rows = []
        items = []
        choices = [:]
        lastOutline = []
        online = [:]
        askedOnline = []
        searchingOnline = []
        parsing = []
        uncounted = []
        shown = []
        struck = []
        named = [:]
        gone = [:]
        notice = nil
    }

    private func holdParsed(after old: [RambleRow]) {
        let before = Dictionary(old.map { ($0.key, $0) }, uniquingKeysWith: { $1 })
        let live = phase == .listening || phase == .finishing
        let held = rows.filter { row in
            guard !parsing.contains(row.key) else { return false }
            guard let earlier = before[row.key] else { return live }
            return row.content == .searching && earlier.content != .searching
        }
        guard !held.isEmpty else { return }
        parsing.formUnion(held.map(\.key))
        uncounted.formUnion(held.map(\.key))
        Task { [weak self] in
            try? await Task.sleep(for: Self.parsedFor)
            self?.parsing.subtract(held.map(\.key))
            try? await Task.sleep(for: .milliseconds(250))
            self?.uncounted.subtract(held.map(\.key))
        }
    }

    private func respan(leaving old: [RambleRow] = []) {
        var next: [Int: Range<Int>] = [:]
        for row in rows {
            if let span = words.span(of: row.item.said) { next[row.key] = span }
        }
        for (key, span) in next where named[key] == nil { named[key] = span }
        let kept = Set(rows.map(\.key))
        for row in old where !kept.contains(row.key) {
            guard let span = named[row.key] else { continue }
            struck.formUnion(span)
            gone[row.item.identity] = span
        }
        for row in rows {
            guard let span = gone.removeValue(forKey: row.item.identity) else { continue }
            struck.subtract(span)
        }
        if next != spans { spans = next }
    }

    private func end(_ token: Int, notice: String) {
        guard token == generation else { return }
        self.notice = notice
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
            Self.log.error("Ramble could not read the log: \(String(describing: error))")
            return RambleContext()
        }
    }

    private func currentShown() -> [RambleRequest.Shown] {
        rows.compactMap { row -> RambleRequest.Shown? in
            guard case let .food(food) = row.content, !food.options.isEmpty else { return nil }
            return RambleRequest.Shown(item: row.id, options: food.options.prefix(RambleResolver.collapsedOptions).map { String($0.portion.food.displayName.prefix(200)) })
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
        var resolver = RambleResolver(index: index(), context: context ?? RambleContext(), today: CalendarDay(now), fallback: fallback)
        resolver.online = online
        let items = items, choices = choices
        if let parsed = try? resolver.rows(items, previous: rows.lined(up: items), choices: choices, search: false) {
            let keyed = parsed.keyed(after: rows, next: &keys)
            if keyed != rows { rows = keyed }
        }
        let previous = rows
        let searcher = resolver
        let task = Task { [weak self] in
            let resolved = await Task.detached { try? searcher.rows(items, previous: previous, choices: choices) }.value
            guard let self, let resolved, token == resolution, !Task.isCancelled else { return }
            let keyed = resolved.keyed(after: rows, next: &keys)
            if keyed != rows { rows = keyed }
            sendShown()
            askOnline()
        }
        resolving = task
        return task
    }

    /// The outline's items and every shown item the last outline still had, in their places: an item leaves only when
    /// two outlines in a row lack it, since the model sometimes drops a food mid-sentence ("remove the pear, make the")
    /// and brings it back a read later. A spoken removal still lands, one read later.
    nonisolated static func held(_ new: [RambleItem], showing: [RambleItem], last: [RambleItem]) -> [RambleItem] {
        let aligned = RambleAlignment.align(showing.map(\.identity), new.map(\.identity))
        let continued = Set(aligned.values.map(\.old))
        let before = Set(last.map(\.identity))
        var result = new
        var inserted = 0
        for (i, item) in showing.enumerated() where !continued.contains(i) && before.contains(item.identity) {
            let at = aligned.filter { $0.value.old > i }.map(\.key).min() ?? new.count
            result.insert(item, at: at + inserted)
            inserted += 1
        }
        return result
    }

    /// Searches online for each unmatched name not asked yet, and resolves again when one finds something.
    private func askOnline() {
        for row in rows where row.content == .unmatched {
            let name = row.item.name.lowercased()
            guard askedOnline.insert(name).inserted else { continue }
            searchingOnline.insert(name)
            Task { [weak self] in
                guard let self else { return }
                let found = await searchOnline(row.item.name)
                searchingOnline.remove(name)
                guard !found.isEmpty else { return }
                online[name] = found
                resolve()
            }
        }
    }

    /// The live session reads picks against the options on screen, so it hears of every change to them.
    private func sendShown() {
        guard let stream else { return }
        let now = currentShown()
        guard now != shown else { return }
        shown = now
        stream.show(now)
    }

    #if DEBUG
    /// DEBUG-only: `-RambleAudio <path>`, a 16 kHz WAV played into the live session in real time in place of the mic,
    /// since the simulator has none. The capture keeps listening until stopped.
    static let audioArgument = "RambleAudio"

    private func replay(_ url: URL, token: Int) {
        replaying = Task { [weak self, recorder, meter] in
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
                Self.log.error("No ramble audio: \(String(describing: error))")
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
    #endif
}
