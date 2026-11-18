import Compression
import Foundation

/// The zip container under `.xlsx`, over Apple's `Compression` (whose `COMPRESSION_ZLIB` is raw DEFLATE, the zip
/// method 8 payload). Reads stored and deflated entries through the central directory; writes deflated entries.
enum Zip {
    static func entries(of archive: Data) throws -> [String: Data] {
        let bytes = [UInt8](archive)
        guard let end = endOfCentralDirectory(in: bytes) else { throw TransferError.notAnXLSX }
        let count = Int(bytes.u16(at: end + 10))
        var offset = Int(bytes.u32(at: end + 16))
        var entries: [String: Data] = [:]
        for _ in 0..<count {
            guard offset + 46 <= bytes.count, bytes.u32(at: offset) == 0x0201_4B50 else { throw TransferError.notAnXLSX }
            let method = bytes.u16(at: offset + 10)
            let compressedSize = Int(bytes.u32(at: offset + 20))
            let size = Int(bytes.u32(at: offset + 24))
            let nameLength = Int(bytes.u16(at: offset + 28))
            let extraLength = Int(bytes.u16(at: offset + 30))
            let commentLength = Int(bytes.u16(at: offset + 32))
            let local = Int(bytes.u32(at: offset + 42))
            guard offset + 46 + nameLength <= bytes.count else { throw TransferError.notAnXLSX }
            let name = String(decoding: bytes[(offset + 46)..<(offset + 46 + nameLength)], as: UTF8.self)
            offset += 46 + nameLength + extraLength + commentLength

            guard local + 30 <= bytes.count, bytes.u32(at: local) == 0x0403_4B50 else { throw TransferError.notAnXLSX }
            let start = local + 30 + Int(bytes.u16(at: local + 26)) + Int(bytes.u16(at: local + 28))
            guard start + compressedSize <= bytes.count else { throw TransferError.notAnXLSX }
            let payload = Array(bytes[start..<(start + compressedSize)])
            switch method {
            case 0: entries[name] = Data(payload)
            case 8: entries[name] = try inflate(payload, size: size)
            default: throw TransferError.notAnXLSX
            }
        }
        return entries
    }

    /// Entries keep the given order, as MF's files list `[Content_Types].xml` and the parts in a fixed order.
    static func archive(_ entries: [(path: String, data: Data)], modified: Date) throws -> Data {
        let (time, date) = dosTimestamp(modified)
        var out: [UInt8] = []
        var directory: [UInt8] = []
        for entry in entries {
            let raw = [UInt8](entry.data)
            let deflated = try deflate(raw)
            let name = Array(entry.path.utf8)
            let crc = crc32(raw)
            var fields: [UInt8] = []
            fields.append(u16: 20)
            fields.append(u16: 0)
            fields.append(u16: 8)
            fields.append(u16: time)
            fields.append(u16: date)
            fields.append(u32: crc)
            fields.append(u32: UInt32(deflated.count))
            fields.append(u32: UInt32(raw.count))
            fields.append(u16: UInt16(name.count))
            fields.append(u16: 0)

            directory.append(u32: 0x0201_4B50)
            directory.append(u16: 20)
            directory.append(contentsOf: fields)
            directory.append(u16: 0)
            directory.append(u16: 0)
            directory.append(u16: 0)
            directory.append(u32: 0)
            directory.append(u32: UInt32(out.count))
            directory.append(contentsOf: name)

            out.append(u32: 0x0403_4B50)
            out.append(contentsOf: fields)
            out.append(contentsOf: name)
            out.append(contentsOf: deflated)
        }
        let directoryOffset = out.count
        out.append(contentsOf: directory)
        out.append(u32: 0x0605_4B50)
        out.append(u16: 0)
        out.append(u16: 0)
        out.append(u16: UInt16(entries.count))
        out.append(u16: UInt16(entries.count))
        out.append(u32: UInt32(directory.count))
        out.append(u32: UInt32(directoryOffset))
        out.append(u16: 0)
        return Data(out)
    }

    static func crc32(_ bytes: [UInt8]) -> UInt32 {
        var crc: UInt32 = 0xFFFF_FFFF
        for byte in bytes { crc = crcTable[Int((crc ^ UInt32(byte)) & 0xFF)] ^ (crc >> 8) }
        return crc ^ 0xFFFF_FFFF
    }

    private static let crcTable: [UInt32] = (0..<256).map { index in
        var value = UInt32(index)
        for _ in 0..<8 { value = value & 1 == 1 ? 0xEDB8_8320 ^ (value >> 1) : value >> 1 }
        return value
    }

    /// The record sits in the last 22 bytes unless the archive has a comment, which can be up to 64 KB long.
    private static func endOfCentralDirectory(in bytes: [UInt8]) -> Int? {
        guard bytes.count >= 22 else { return nil }
        let lowest = max(0, bytes.count - 22 - 0xFFFF)
        return stride(from: bytes.count - 22, through: lowest, by: -1).first { bytes.u32(at: $0) == 0x0605_4B50 }
    }

    private static func inflate(_ payload: [UInt8], size: Int) throws -> Data {
        guard size > 0 else { return Data() }
        var output = [UInt8](repeating: 0, count: size)
        let written = compression_decode_buffer(&output, size, payload, payload.count, nil, COMPRESSION_ZLIB)
        guard written == size else { throw TransferError.notAnXLSX }
        return Data(output)
    }

    private static func deflate(_ raw: [UInt8]) throws -> [UInt8] {
        // An empty input deflates to one empty final block; compression_encode_buffer returns 0 for it.
        guard !raw.isEmpty else { return [0x03, 0x00] }
        let capacity = raw.count + raw.count / 2 + 64
        var output = [UInt8](repeating: 0, count: capacity)
        let written = compression_encode_buffer(&output, capacity, raw, raw.count, nil, COMPRESSION_ZLIB)
        guard written > 0 else { throw CocoaError(.fileWriteUnknown) }
        return Array(output.prefix(written))
    }

    private static func dosTimestamp(_ date: Date) -> (time: UInt16, date: UInt16) {
        let parts = Calendar(identifier: .gregorian).dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
        let time = (parts.hour ?? 0) << 11 | (parts.minute ?? 0) << 5 | (parts.second ?? 0) / 2
        let day = max((parts.year ?? 1980) - 1980, 0) << 9 | (parts.month ?? 1) << 5 | (parts.day ?? 1)
        return (UInt16(time), UInt16(day))
    }
}

private extension [UInt8] {
    func u16(at offset: Int) -> UInt16 { UInt16(self[offset]) | UInt16(self[offset + 1]) << 8 }

    func u32(at offset: Int) -> UInt32 {
        UInt32(self[offset]) | UInt32(self[offset + 1]) << 8 | UInt32(self[offset + 2]) << 16 | UInt32(self[offset + 3]) << 24
    }

    mutating func append(u16 value: UInt16) {
        append(UInt8(value & 0xFF))
        append(UInt8(value >> 8))
    }

    mutating func append(u32 value: UInt32) {
        for shift in stride(from: 0, to: 32, by: 8) { append(UInt8((value >> UInt32(shift)) & 0xFF)) }
    }
}
