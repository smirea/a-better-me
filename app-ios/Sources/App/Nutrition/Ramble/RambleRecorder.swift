import AVFoundation
import Foundation
import Synchronization

/// The mic's audio as 16 kHz mono 16-bit PCM chunks, streamed to the live session.
nonisolated final class RambleRecorder: Sendable {
    static let format = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16_000, channels: 1, interleaved: true)!

    private struct State {
        var converter: AVAudioConverter?
        var stream: (@Sendable (Data) -> Void)?
    }

    /// Written from the audio tap's thread and set on the main actor.
    private let state = Mutex(State())

    /// Before a listen: the converter follows the mic's format, which can change between listens.
    func begin(_ input: AVAudioFormat) throws {
        guard let converter = AVAudioConverter(from: input, to: Self.format) else { throw RambleMic.Failure.unsupported }
        state.withLock { $0.converter = converter }
    }

    func stream(to sink: (@Sendable (Data) -> Void)?) {
        state.withLock { $0.stream = sink }
    }

    func write(_ buffer: AVAudioPCMBuffer) {
        let (chunk, sink) = state.withLock { state -> (Data?, (@Sendable (Data) -> Void)?) in
            guard let converter = state.converter, let sink = state.stream else { return (nil, nil) }
            let capacity = AVAudioFrameCount(Double(buffer.frameLength) * Self.format.sampleRate / buffer.format.sampleRate) + 16
            guard let out = AVAudioPCMBuffer(pcmFormat: Self.format, frameCapacity: capacity) else { return (nil, nil) }
            nonisolated(unsafe) var fed = false
            var error: NSError?
            converter.convert(to: out, error: &error) { _, status in
                if fed {
                    status.pointee = .noDataNow
                    return nil
                }
                fed = true
                status.pointee = .haveData
                return buffer
            }
            guard error == nil, let channel = out.int16ChannelData else { return (nil, nil) }
            return (Data(bytes: channel[0], count: Int(out.frameLength) * 2), sink)
        }
        if let chunk, let sink { sink(chunk) }
    }
}
