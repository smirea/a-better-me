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

    @Test func aRenamedRowContinuesTheRelatedRowNotTheOneTakenBackBeforeIt() {
        var next = 0
        let (first, _) = keys(["apple", "pear", "dates"], after: [], next: &next)
        let (_, after) = keys(["apple", "date"], after: first, next: &next)
        #expect(after == [1, 3])
    }

    @Test func aRenamedRowKeepsItsKeyAndANewOneTakesTheNext() {
        var next = 0
        let (first, _) = keys(["chicken salad", "coke", "fries"], after: [], next: &next)
        let (_, after) = keys(["chicken salad", "diet coke", "fries", "ketchup"], after: first, next: &next)
        #expect(after == [1, 2, 3, 4])
    }

    @Test func anUnrelatedReplacementIsANewRow() {
        var next = 0
        let (first, _) = keys(["burrito bowl"], after: [], next: &next)
        let (second, keys2) = keys(["tacos"], after: first, next: &next)
        #expect(keys2 == [2])
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

    @Test func aGapPairsRelatedItemsAndTheRestAreNew() {
        #expect(align(["salad", "coke", "fries"], ["salad", "lemonade", "diet coke", "fries"]) == ["0", "new", "1~", "2"])
        #expect(align([], ["oats"]) == ["new"])
        #expect(align(["oats", "oats"], ["oats"]) == ["0"])
    }
}

struct RambleLinedUpTests {
    @Test func aRowMovedUpByARemovalIsReadAtItsNewPosition() {
        let rows = ["apple", "pear", "dates"].enumerated().map {
            RambleRow(id: $0, item: RambleItem(name: $1), day: calendarDay("2026-10-29"), minute: nil, content: .unmatched)
        }
        let lined = rows.lined(up: [RambleItem(name: "apple"), RambleItem(name: "dates", amount: 3)])
        #expect(lined.sorted { $0.id < $1.id }.map { "\($0.id) \($0.item.name)" } == ["0 apple", "1 dates"])
    }
}

struct RambleHeldTests {
    func names(_ new: [String], showing: [String], last: [String]) -> [String] {
        let items = { (names: [String]) in names.map { RambleItem(name: $0) } }
        return RambleCapture.held(items(new), showing: items(showing), last: items(last)).map(\.name)
    }

    @Test func aFoodDroppedByOneOutlineStaysInItsPlace() {
        #expect(names(["apple", "pear"], showing: ["apple", "pear", "dates"], last: ["apple", "pear", "dates"]) == ["apple", "pear", "dates"])
        #expect(names(["apple"], showing: ["apple", "pear", "dates"], last: ["apple", "pear", "dates"]) == ["apple", "pear", "dates"])
    }

    @Test func aFoodTwoOutlinesLackIsGoneAndARenameIsNotKeptBesideItsNewName() {
        #expect(names(["apple", "dates"], showing: ["apple", "pear", "dates"], last: ["apple", "dates"]) == ["apple", "dates"])
        #expect(names(["salad", "diet coke"], showing: ["salad", "coke"], last: ["salad", "coke"]) == ["salad", "diet coke"])
    }
}
