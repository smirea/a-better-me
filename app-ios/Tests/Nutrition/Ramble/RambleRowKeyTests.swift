import Testing
@testable import App

struct RambleRowKeyTests {
    func rows(_ names: [String]) -> [RambleRow] {
        names.enumerated().map { RambleRow(id: $0, item: RambleItem(name: $1), day: calendarDay("2026-10-29"), minute: nil, content: .unmatched) }
    }

    func keys(_ names: [String], after old: [RambleRow], next: inout Int) -> ([RambleRow], [Int]) {
        let keyed = rows(names).keyed(after: old, next: &next)
        return (keyed, keyed.map(\.key))
    }

    @Test func aRemovedRowLeavesTheOthersTheirKeys() {
        var next = 0
        let (first, firstKeys) = keys(["eggs", "toast", "coffee"], after: [], next: &next)
        #expect(firstKeys == [1, 2, 3])
        let (_, after) = keys(["eggs", "coffee"], after: first, next: &next)
        #expect(after == [1, 3])
    }

    @Test func aRenamedRowKeepsItsKeyAndANewOneTakesTheNext() {
        var next = 0
        let (first, _) = keys(["chicken salad", "coke", "fries"], after: [], next: &next)
        let (_, after) = keys(["chicken salad", "diet coke", "fries", "ketchup"], after: first, next: &next)
        #expect(after == [1, 2, 3, 4])
    }

    @Test func aReplacedRowAtTheEndKeepsItsKey() {
        var next = 0
        let (first, _) = keys(["burrito bowl"], after: [], next: &next)
        let (second, keys2) = keys(["tacos"], after: first, next: &next)
        #expect(keys2 == [1])
        let (_, keys3) = keys([], after: second, next: &next)
        #expect(keys3 == [])
    }

    func align(_ old: [String], _ new: [String]) -> [String] {
        let aligned = RambleAlignment.align(old, new)
        return new.indices.map { j in aligned[j].map { "\($0.old)\($0.same ? "" : "~")" } ?? "new" }
    }

    @Test func anItemHeardEarlierMovesTheRestDown() {
        #expect(align(["eggs", "toast", "coffee"], ["water", "eggs", "toast", "coffee"]) == ["new", "0", "1", "2"])
    }

    @Test func aGapPairsItsItemsInOrderAndTheRestAreNew() {
        #expect(align(["salad", "coke", "fries"], ["salad", "diet coke", "lemonade", "fries"]) == ["0", "1~", "new", "2"])
        #expect(align([], ["oats"]) == ["new"])
        #expect(align(["oats", "oats"], ["oats"]) == ["0"])
    }
}
