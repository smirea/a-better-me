import AVFoundation
import Foundation
import Synchronization

/// The ramble's audio as 16 kHz mono 16-bit WAV, for the final read: the server's model hears food names that
/// on-device speech-to-text gets wrong. It spans every listen of one ramble, because the final read covers the whole
/// transcript. Past `maxSeconds` it stops keeping audio and the final read goes without it, since the server takes
/// at most 8 MB of base64.
nonisolated final class RambleRecorder: Sendable {
    static let maxSeconds = 120.0
    static let format = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16_000, channels: 1, interleaved: true)!

    private struct State {
        var converter: AVAudioConverter?
        var samples = Data()
        var overflowed = false
    }

    /// Written from the audio tap's thread and read on the main actor after the tap is gone.
    private let state = Mutex(State())

    /// Before a listen: the converter follows the mic's format, which can change between listens.
    func begin(_ input: AVAudioFormat) throws {
        guard let converter = AVAudioConverter(from: input, to: Self.format) else { throw SpeechDictation.Failure.unsupported }
        state.withLock { $0.converter = converter }
    }

    func write(_ buffer: AVAudioPCMBuffer) {
        state.withLock { state in
            guard let converter = state.converter, !state.overflowed else { return }
            let capacity = AVAudioFrameCount(Double(buffer.frameLength) * Self.format.sampleRate / buffer.format.sampleRate) + 16
            guard let out = AVAudioPCMBuffer(pcmFormat: Self.format, frameCapacity: capacity) else { return }
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
            guard error == nil, let channel = out.int16ChannelData else { return }
            state.samples.append(Data(bytes: channel[0], count: Int(out.frameLength) * 2))
            if Double(state.samples.count) / 2 / Self.format.sampleRate > Self.maxSeconds { state.overflowed = true }
        }
    }

    /// The whole ramble as a WAV file, or nil when there is none or it ran past `maxSeconds`.
    func wav() -> Data? {
        state.withLock { state in
            guard !state.samples.isEmpty, !state.overflowed else { return nil }
            return Self.header(bytes: state.samples.count) + state.samples
        }
    }

    func reset() {
        state.withLock { $0 = State() }
    }

    private static func header(bytes: Int) -> Data {
        var data = Data()
        func append<T: FixedWidthInteger>(_ value: T) { withUnsafeBytes(of: value.littleEndian) { data.append(contentsOf: $0) } }
        let rate = UInt32(format.sampleRate)
        data.append(contentsOf: Array("RIFF".utf8))
        append(UInt32(36 + bytes))
        data.append(contentsOf: Array("WAVEfmt ".utf8))
        append(UInt32(16))
        append(UInt16(1))
        append(UInt16(1))
        append(rate)
        append(rate * 2)
        append(UInt16(2))
        append(UInt16(16))
        data.append(contentsOf: Array("data".utf8))
        append(UInt32(bytes))
        return data
    }
}
