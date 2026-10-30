import AVFoundation
import Foundation
import SwiftUI
import Synchronization

/// The microphone for a ramble: its audio goes to `RambleRecorder`, which streams it to the live session, and each
/// buffer's peak to `LevelMeter` for the waveform. The server transcribes; only the microphone needs permission.
@MainActor
final class RambleMic {
    enum Failure: Error {
        case unsupported
        case denied
    }

    private var engine: AVAudioEngine?

    func start(meter: LevelMeter, recorder: RambleRecorder) async throws {
        guard await AVAudioApplication.requestRecordPermission() else { throw Failure.denied }
        let audio = AVAudioEngine()
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .measurement, options: [.duckOthers])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
            let node = audio.inputNode
            let format = node.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else { throw Failure.unsupported }
            try recorder.begin(format)
            try node.installAudioTap(onBus: 0, bufferSize: 1024, format: format, tapProvider: Self.tap(meter, recorder))
            audio.prepare()
            try audio.start()
        } catch {
            stop()
            throw error
        }
        engine = audio
    }

    /// The tap runs on the audio thread.
    nonisolated private static func tap(_ meter: LevelMeter, _ recorder: RambleRecorder) -> @Sendable (AVReadOnlyAudioPCMBuffer, AVAudioTime) -> Void {
        { buffer, _ in
            if case let .float(channel) = buffer.channelData(0) {
                var peak: Float = 0
                for index in 0 ..< Int(buffer.frameLength) { peak = max(peak, abs(channel[index])) }
                meter.set(peak)
            }
            recorder.write(AVAudioPCMBuffer(copying: buffer))
        }
    }

    func stop() {
        engine?.inputNode.removeTap(onBus: 0)
        engine?.stop()
        engine = nil
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
