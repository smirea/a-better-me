import Foundation

/// A food's name as search reads it: case and accents folded, split into words, and stemmed so "Bananas" matches
/// "banana" and "cookie" matches "Cookies". Names keep USDA's comma structure ("Chicken, broilers or fryers, breast"),
/// whose first part names the food and the rest describe it, so `score` weighs a match there most.
struct FoodText: Sendable {
    let words: [String]
    /// The words of the first two comma-separated parts.
    private let head: [String]
    private let second: [String]

    init(_ name: String, brand: String? = nil) {
        let parts = name.split(separator: ",", omittingEmptySubsequences: false)
        head = parts.first.map { Self.terms(String($0)) } ?? []
        second = parts.dropFirst().first.map { Self.terms(String($0)) } ?? []
        words = Self.terms(name) + Self.terms(brand ?? "")
    }

    /// The query's search terms, stemmed the same way as names.
    static func terms(_ text: String) -> [String] {
        text.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil)
            .split { !($0.isLetter || $0.isNumber || $0 == "%") }
            .map { stem(String($0)) }
    }

    /// Plural and "-ie" endings, so both sides of a match reduce to one form; a query word also matches any word it
    /// starts, which covers the rest of what the user has not typed yet.
    static func stem(_ word: String) -> String {
        guard word.count > 3 else { return word }
        if word.hasSuffix("ies") { return String(word.dropLast(3)) + "y" }
        if word.hasSuffix("ie") { return String(word.dropLast(2)) + "y" }
        var word = word
        if word.hasSuffix("s"), !word.hasSuffix("ss") { word.removeLast() }
        if word.count > 4, word.hasSuffix("oe") { word.removeLast() }
        return word
    }

    /// How well `terms` name this food, or nil when one of them matches no word. Covering the first part outweighs
    /// everything ("Bananas, raw" for "banana"); a match in the second part counts for less ("Fish, salmon"), whole
    /// words beat prefixes ("Egg" over "Eggplant" for "egg"), and a shorter, plainer name beats a longer one.
    func score(_ terms: [String]) -> Double? {
        guard !terms.isEmpty else { return nil }
        var exact = 0
        for term in terms {
            if words.contains(term) {
                exact += 1
            } else if !words.contains(where: { $0.hasPrefix(term) }) {
                return nil
            }
        }
        func coverage(_ part: [String]) -> Double {
            part.isEmpty ? 0 : Double(part.count { word in terms.contains { word.hasPrefix($0) } }) / Double(part.count)
        }
        return 10 * max(coverage(head), 0.6 * coverage(second)) + 3 * Double(exact) / Double(terms.count) - 0.5 * Double(words.count)
    }
}
