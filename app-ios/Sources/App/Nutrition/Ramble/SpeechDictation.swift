import AVFoundation
import Foundation
import Speech
import SwiftUI
import Synchronization

/// Apple's on-device speech-to-text: `SpeechAnalyzer` with a `SpeechTranscriber`, else a `DictationTranscriber` where the
/// first is missing, which works offline. The language
/// assets download on first use. Only the microphone needs permission. Ported from procrastimate's `SpeechDictation`,
/// which uses a `DictationTranscriber`; on spoken food rambles that one garbled food words ("200 mL of air actual
/// weight" for "200ml of kefir, actually wait") that `SpeechTranscriber` kept (`scripts/food-ramble-speech.ts`).
@MainActor
final class SpeechDictation {
    enum Failure: Error {
        case unsupported
        case denied
    }

    private var engine: AVAudioEngine?
    private var input: AsyncStream<AnalyzerInput>.Continuation?
    private var analyzer: SpeechAnalyzer?
    private var reader: Task<Void, Never>?

    /// Streams the transcript so far to `onText`, finalized text followed by the words still being recognized; nil
    /// listens without transcribing, for Gemini Live. The tap also writes each buffer's peak to `meter` for the waveform
    /// and the audio to `recorder`, for the final read and for Gemini Live.
    func start(meter: LevelMeter, recorder: RambleRecorder, onText: (@MainActor (String) -> Void)?) async throws {
        var feed: (converter: AnalyzerInputConverter, input: AsyncStream<AnalyzerInput>.Continuation)?
        if let onText { feed = try await transcribe(onText) }
        guard await AVAudioApplication.requestRecordPermission() else {
            cancel()
            throw Failure.denied
        }
        let audio = AVAudioEngine()
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .measurement, options: [.duckOthers])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
            let node = audio.inputNode
            let format = node.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else { throw Failure.unsupported }
            try recorder.begin(format)
            try node.installAudioTap(onBus: 0, bufferSize: 1024, format: format, tapProvider: Self.feed(feed, meter, recorder))
            audio.prepare()
            try audio.start()
        } catch {
            cancel()
            throw error
        }
        engine = audio
    }

    private func transcribe(_ onText: @escaping @MainActor (String) -> Void) async throws -> (converter: AnalyzerInputConverter, input: AsyncStream<AnalyzerInput>.Continuation) {
        let english = Locale(identifier: "en-US")
        let module: any SpeechModule
        let results: AsyncThrowingStream<(isFinal: Bool, text: AttributedString), Error>
        // SpeechTranscriber is missing on some hardware and on the simulator; dictation is the fallback.
        if SpeechTranscriber.isAvailable, let locale = await SpeechTranscriber.supportedLocale(equivalentTo: english) {
            let transcriber = SpeechTranscriber(locale: locale, transcriptionOptions: [], reportingOptions: [.volatileResults, .fastResults], attributeOptions: [])
            module = transcriber
            results = Self.texts(transcriber.results) { ($0.isFinal, $0.text) }
        } else if let locale = await DictationTranscriber.supportedLocale(equivalentTo: english) {
            let transcriber = DictationTranscriber(
                locale: locale, contentHints: [], transcriptionOptions: [.punctuation],
                reportingOptions: [.volatileResults, .frequentFinalization], attributeOptions: []
            )
            module = transcriber
            results = Self.texts(transcriber.results) { ($0.isFinal, $0.text) }
        } else {
            throw Failure.unsupported
        }
        RambleOutliner.log.info("Ramble listens with \(String(describing: type(of: module)))")
        if let request = try await AssetInventory.assetInstallationRequest(supporting: [module]) {
            try await request.downloadAndInstall()
        }
        let converter = try await AnalyzerInputConverter.converter(compatibleWith: [module])
        let (stream, input) = AsyncStream.makeStream(of: AnalyzerInput.self)
        let analyzer = SpeechAnalyzer(modules: [module])
        reader = Task {
            var finalized = AttributedString()
            do {
                for try await result in results {
                    if result.isFinal { finalized += result.text }
                    onText(String((result.isFinal ? finalized : finalized + result.text).characters))
                }
            } catch {
                RambleOutliner.log.error("Dictation stopped: \(String(describing: error))")
            }
        }
        try await analyzer.start(inputSequence: stream)
        self.analyzer = analyzer
        self.input = input
        return (converter, input)
    }

    /// The two transcribers' result streams as one shape.
    nonisolated private static func texts<Results: AsyncSequence & Sendable>(
        _ results: Results,
        _ text: @escaping @Sendable (Results.Element) -> (isFinal: Bool, text: AttributedString)
    ) -> AsyncThrowingStream<(isFinal: Bool, text: AttributedString), Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    for try await result in results { continuation.yield(text(result)) }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    /// The tap runs on the audio thread. The converter is only ever used there once the tap is installed.
    nonisolated private static func feed(
        _ feed: (converter: AnalyzerInputConverter, input: AsyncStream<AnalyzerInput>.Continuation)?,
        _ meter: LevelMeter,
        _ recorder: RambleRecorder
    ) -> @Sendable (AVReadOnlyAudioPCMBuffer, AVAudioTime) -> Void {
        nonisolated(unsafe) let feed = feed
        return { buffer, time in
            if case let .float(channel) = buffer.channelData(0) {
                var peak: Float = 0
                for index in 0 ..< Int(buffer.frameLength) { peak = max(peak, abs(channel[index])) }
                meter.set(peak)
            }
            let copy = AVAudioPCMBuffer(copying: buffer)
            recorder.write(copy)
            guard let feed, let items = try? feed.converter.convert(copy, at: time) else { return }
            for item in items { feed.input.yield(item) }
        }
    }

    /// Stops listening and waits until the words already heard are final, so the last of them are not lost.
    func finish() async {
        let analyzer = self.analyzer
        let reader = self.reader
        halt()
        try? await analyzer?.finalizeAndFinishThroughEndOfInput()
        await reader?.value
    }

    func cancel() {
        reader?.cancel()
        halt()
    }

    private func halt() {
        engine?.inputNode.removeTap(onBus: 0)
        engine?.stop()
        engine = nil
        input?.finish()
        input = nil
        analyzer = nil
        reader = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

/// The mic level, written by the audio tap at audio rate and read once per frame by the waveform, so a loud mic never
/// re-renders the tab.
final class LevelMeter: Sendable {
    private let value = Mutex<Float>(0)

    var level: Float { value.withLock { $0 } }

    func set(_ level: Float) {
        value.withLock { $0 = level }
    }
}

/// Capsule bars driven by the real mic level. The newest level sits in the middle and older ones ripple out to both
/// edges. At rest every bar settles to a dot.
struct RambleWaveform: View {
    let meter: LevelMeter
    let active: Bool

    @State private var wave = Wave()

    var body: some View {
        TimelineView(.animation(paused: !active)) { timeline in
            // Canvas redraws only when its closure changes, so reading the frame's date makes every tick a new one.
            let frame = timeline.date
            Canvas { context, size in
                _ = frame
                let bars = min(41, Int(size.width / 9) | 1)
                let heights = wave.step(level: active ? meter.level : 0, active: active, bars: bars, height: size.height)
                let step = size.width / CGFloat(bars)
                for (index, bar) in heights.enumerated() {
                    let rect = CGRect(x: CGFloat(index) * step + step / 2 - 2, y: (size.height - bar.size) / 2, width: 4, height: bar.size)
                    context.fill(Capsule().path(in: rect), with: .color(Theme.textPrimary.opacity(bar.alpha)))
                }
            }
        }
        .accessibilityHidden(true)
    }

    /// The smoothing state between frames. A plain class, so stepping it while drawing never invalidates the view.
    final class Wave {
        private var history = [Double](repeating: 0, count: 48)
        private var smoothed = 0.0
        private var presence = 0.0

        func step(level: Float, active: Bool, bars: Int, height: CGFloat) -> [(size: CGFloat, alpha: Double)] {
            let target = Double(level)
            smoothed += (target - smoothed) * (target > smoothed ? 0.45 : 0.12)
            presence += ((active ? 1 : 0) - presence) * 0.08
            history.removeFirst()
            history.append(smoothed)
            let centre = Double(bars - 1) / 2
            return (0 ..< bars).map { index in
                let distance = centre > 0 ? abs(Double(index) - centre) / centre : 0
                let age = Int((distance * Double(history.count - 1)).rounded())
                let loud = min(1, history[history.count - 1 - age].squareRoot() * 1.6)
                let taper = 1 - distance * distance * 0.55
                return (
                    CGFloat(4 + loud * (height - 4) * taper * presence),
                    (0.3 + 0.7 * (1 - distance)) * (0.35 + 0.65 * presence)
                )
            }
        }
    }
}
