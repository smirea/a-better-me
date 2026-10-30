import Foundation

/// The transcript as words, which the tab lays out one view each, so the words a row came from have frames to fly from.
struct RambleWords: Equatable, Sendable {
    struct Word: Equatable, Sendable {
        let text: String
        /// Still being heard; it may change.
        let partial: Bool
        /// What a quote matches it by: lowercased letters and digits.
        let key: String
    }

    private(set) var words: [Word] = []

    init(_ heard: RambleHeard = RambleHeard()) {
        words = Self.split(heard.committed, partial: false) + Self.split(heard.partial, partial: true)
    }

    /// Where `said` falls in the words: its last exact occurrence, else the last window holding most of its words in
    /// order, since the model may misquote a word or the partial it quoted may have changed. Nil when under 60% of its
    /// words are found.
    func span(of said: String) -> Range<Int>? {
        let quote = Self.split(said, partial: false).map(\.key)
        guard !quote.isEmpty, !words.isEmpty else { return nil }
        let keys = words.map(\.key)
        if quote.count <= keys.count {
            for start in stride(from: keys.count - quote.count, through: 0, by: -1) where keys[start] == quote[0] {
                if keys[start ..< start + quote.count].elementsEqual(quote) { return start ..< start + quote.count }
            }
        }
        let needed = max(1, Int((Double(quote.count) * 0.6).rounded(.up)))
        var best: (found: Int, range: Range<Int>)?
        let width = quote.count + 2
        for start in 0 ..< keys.count {
            let window = keys[start ..< min(keys.count, start + width)]
            var found = 0, first: Int?, last = start, next = 0
            for (offset, key) in zip(window.indices, window) {
                guard let match = quote[next...].firstIndex(of: key) else { continue }
                found += 1
                next = match + 1
                first = first ?? offset
                last = offset
                if next == quote.count { break }
            }
            if let first, found >= needed, found >= (best?.found ?? 0) { best = (found, first ..< last + 1) }
        }
        return best?.range
    }

    private static func split(_ text: String, partial: Bool) -> [Word] {
        text.split(whereSeparator: \.isWhitespace).compactMap { word in
            let key = word.lowercased().filter { $0.isLetter || $0.isNumber }
            return key.isEmpty ? nil : Word(text: String(word), partial: partial, key: key)
        }
    }
}
