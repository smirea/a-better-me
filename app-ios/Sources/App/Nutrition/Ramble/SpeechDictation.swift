import AVFoundation
import Foundation
import Speech
import SwiftUI
import Synchronization

/// Apple's on-device speech-to-text: `SpeechAnalyzer` with a `SpeechTranscriber`, which works offline. The language
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
    #if DEBUG
    private var playback: Task<Void, Never>?
    #endif

    /// Streams the transcript so far, finalized text followed by the words still being recognized. The tap also writes
    /// each buffer's peak to `meter` for the waveform and the audio to `recorder` for the final read.
    func start(meter: LevelMeter, recorder: RambleRecorder, onText: @escaping @MainActor (String) -> Void) async throws {
        guard let locale = await SpeechTranscriber.supportedLocale(equivalentTo: Locale(identifier: "en-US")) else {
            throw Failure.unsupported
        }
        let transcriber = SpeechTranscriber(
            locale: locale,
            transcriptionOptions: [],
            reportingOptions: [.volatileResults, .fastResults],
            attributeOptions: []
        )
        if let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
            try await request.downloadAndInstall()
        }
        let converter = try await AnalyzerInputConverter.converter(compatibleWith: [transcriber])
        let (stream, input) = AsyncStream.makeStream(of: AnalyzerInput.self)
        let analyzer = SpeechAnalyzer(modules: [transcriber])
        reader = Task {
            var finalized = AttributedString()
            do {
                for try await result in transcriber.results {
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

        #if DEBUG
        if let path = UserDefaults.standard.string(forKey: Self.audioArgument) {
            playback = try Self.play(URL(fileURLWithPath: path), through: converter, into: input, recorder: recorder, meter: meter)
            return
        }
        #endif
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
            try node.installAudioTap(onBus: 0, bufferSize: 1024, format: format, tapProvider: Self.feed(converter, input, meter, recorder))
            audio.prepare()
            try audio.start()
        } catch {
            cancel()
            throw error
        }
        engine = audio
    }

    /// The tap runs on the audio thread. The converter is only ever used there once the tap is installed.
    nonisolated private static func feed(
        _ converter: AnalyzerInputConverter,
        _ input: AsyncStream<AnalyzerInput>.Continuation,
        _ meter: LevelMeter,
        _ recorder: RambleRecorder
    ) -> @Sendable (AVReadOnlyAudioPCMBuffer, AVAudioTime) -> Void {
        nonisolated(unsafe) let converter = converter
        return { buffer, time in
            if case let .float(channel) = buffer.channelData(0) {
                var peak: Float = 0
                for index in 0 ..< Int(buffer.frameLength) { peak = max(peak, abs(channel[index])) }
                meter.set(peak)
            }
            let copy = AVAudioPCMBuffer(copying: buffer)
            recorder.write(copy)
            guard let items = try? converter.convert(copy, at: time) else { return }
            for item in items { input.yield(item) }
        }
    }

    #if DEBUG
    /// DEBUG-only: `-RambleAudio <path>` plays a spoken audio file through the same converter, analyzer, and recorder at
    /// real-time pace, so the simulator, which has no microphone, drives live speech-to-text and the final read.
    static let audioArgument = "RambleAudio"

    private static func play(
        _ url: URL,
        through converter: AnalyzerInputConverter,
        into input: AsyncStream<AnalyzerInput>.Continuation,
        recorder: RambleRecorder,
        meter: LevelMeter
    ) throws -> Task<Void, Never> {
        nonisolated(unsafe) let file = try AVAudioFile(forReading: url)
        try recorder.begin(file.processingFormat)
        nonisolated(unsafe) let converter = converter
        return Task.detached {
            while file.framePosition < file.length, !Task.isCancelled {
                guard let read = try? file.read(frameCount: 1600) else { break }
                let buffer = AVAudioPCMBuffer(copying: read)
                meter.set(.random(in: 0.08 ... 0.5))
                recorder.write(buffer)
                for item in (try? converter.convert(buffer, at: nil)) ?? [] { input.yield(item) }
                try? await Task.sleep(for: .seconds(Double(buffer.frameLength) / file.processingFormat.sampleRate))
            }
            meter.set(0)
        }
    }
    #endif

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
        #if DEBUG
        playback?.cancel()
        playback = nil
        #endif
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
