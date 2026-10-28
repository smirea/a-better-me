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
    @ObservationIgnored private let clock: @Sendable () -> Date
    @ObservationIgnored private let dictation = SpeechDictation()
    @ObservationIgnored private let recorder = RambleRecorder()
    /// The logger's chosen time, where foods said with no day, meal, or time go; nil follows the clock.
    @ObservationIgnored var chosenTime: @MainActor () -> LogTime? = { nil }
    @ObservationIgnored private var outliner: RambleOutliner?
    @ObservationIgnored private var context: RambleContext?
    @ObservationIgnored private var items: [RambleItem] = []
    @ObservationIgnored private var choices: [Int: RambleChoice] = [:]
    @ObservationIgnored private var generation = 0
    @ObservationIgnored private var resolution = 0
    @ObservationIgnored private var script: Task<Void, Never>?
    @ObservationIgnored private var resolving: Task<Void, Never>?

    init(store: LocalStore, index: @escaping @MainActor () -> FoodIndex, client: any RambleOutlining, clock: @escaping @Sendable () -> Date = { .now }) {
        self.store = store
        self.index = index
        self.client = client
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
        do {
            try await dictation.start(meter: meter, recorder: recorder, onText: heard)
            if phase != .listening { dictation.cancel() }
        } catch SpeechDictation.Failure.denied {
            end(token, notice: "The microphone is off. Turn it on in Settings to ramble.")
        } catch {
            RambleOutliner.log.error("Dictation could not start: \(String(describing: error))")
            end(token, notice: "Dictation isn't available right now.")
        }
    }

    /// Stops listening, waits for the last words, then for the final read of the recording, falling back to the
    /// outline of exactly the transcript when there is no recording or the final read fails.
    func stop() async {
        guard phase == .listening else { return }
        let token = generation
        phase = .finishing
        meter.set(0)
        script?.cancel()
        await dictation.finish()
        guard token == generation else { return }
        if let outline = await finalRead() {
            guard token == generation else { return }
            // A live read still in flight would otherwise land after this one and replace it.
            outliner?.stop()
            items = outline.items
            await resolve()?.value
        } else if let outliner, let outline = await outliner.settle(transcript, timeout: Self.settleTimeout) {
            items = outline.items
            await resolve()?.value
        } else if outliner?.off == true {
            notice = "The ramble couldn't be read. The foods so far stay."
        }
        guard token == generation else { return }
        outliner?.stop()
        phase = .review
    }

    private func finalRead() async -> RambleOutline? {
        guard outliner?.off == false, let wav = recorder.wav() else { return nil }
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
        outliner?.stop()
        resolving?.cancel()
    }

    func pick(_ option: FoodSearchResult, in row: RambleRow) {
        choices[row.id] = RambleChoice(name: row.item.name, option: option.key)
        expanded.remove(row.id)
        resolve()
    }

    func setServing(_ serving: Serving, of row: RambleRow) {
        var choice = choices[row.id].flatMap { $0.name == row.item.name ? $0 : nil } ?? RambleChoice(name: row.item.name)
        if case let .food(food) = row.content { choice.option = food.key }
        choice.serving = serving
        choices[row.id] = choice
        resolve()
    }

    func remove(_ row: RambleRow) {
        choices[row.id] = RambleChoice(name: row.item.name, removed: true)
        rows.removeAll { $0.id == row.id }
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
            return RambleContext(entries: entries, today: today)
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
