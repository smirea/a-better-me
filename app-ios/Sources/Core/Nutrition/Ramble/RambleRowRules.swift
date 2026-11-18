import Foundation

/// How a ramble's rows follow the live outline as it is re-read.
enum RambleRowRules {
    /// The outline's items and every shown item the last outline still had, in their places: an item leaves only when
    /// two outlines in a row lack it, since the model sometimes drops a food mid-sentence ("remove the pear, make the")
    /// and brings it back a read later. A spoken removal still lands, one read later.
    static func held(_ new: [RambleItem], showing: [RambleItem], last: [RambleItem]) -> [RambleItem] {
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

    /// The choices without the removals the speaker took back by saying the food again: the model updates a food said
    /// again in place ("2 tablespoons of salt … 1 tablespoon of salt"), so the removed item keeps its name, and only its
    /// quote, now past the removed words, tells.
    static func unsaid(_ choices: [Int: RambleChoice], items: [RambleItem], words: RambleWords) -> [Int: RambleChoice] {
        choices.filter { position, choice in
            guard let through = choice.through, items.indices.contains(position), let span = words.span(of: items[position].said)
            else { return true }
            return span.upperBound <= through
        }
    }
}
