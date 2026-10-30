import Testing
@testable import App

struct RambleWordsTests {
    let words = RambleWords(RambleHeard(
        committed: "So I had 3 cups of oats for breakfast, 1 cup of blueberries,",
        partial: "oh actually never mind, it's 2 tablespoons of oats"
    ))

    func text(_ range: Range<Int>?) -> String? {
        range.map { words.words[$0].map(\.text).joined(separator: " ") }
    }

    @Test func aQuoteFindsItsWordsPunctuationAndCaseAside() {
        #expect(text(words.span(of: "1 Cup of blueberries")) == "1 cup of blueberries,")
    }

    @Test func aQuoteSaidTwiceIsTheLastTime() {
        #expect(text(words.span(of: "of oats")) == "of oats")
        #expect(words.span(of: "of oats") == 20 ..< 22)
    }

    @Test func aCorrectionQuotesItsOwnWordsInThePartial() {
        #expect(text(words.span(of: "actually never mind, it's 2 tablespoons of oats"))
            == "actually never mind, it's 2 tablespoons of oats")
        #expect(words.words[13].partial)
        #expect(!words.words[12].partial)
    }

    @Test func aMisquoteMatchesTheWindowHoldingMostOfItsWords() {
        #expect(text(words.span(of: "three cups of the oats")) == "cups of oats")
        #expect(words.span(of: "a slice of toast") == nil)
        #expect(words.span(of: "") == nil)
    }
}

struct RambleRelatedTests {
    @Test func aRenameKeepsItsMatchOnlyWhenTheNamesShareAWord() {
        #expect(RambleResolver.related("coke", "diet coke"))
        #expect(RambleResolver.related("dates", "medjool date"))
        #expect(!RambleResolver.related("pear", "dates"))
    }
}
