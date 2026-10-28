import Testing
@testable import App

struct RambleLiveTranscriptTests {
    @Test func deviceWordsShowUntilGeminiTranscribesTheirTurn() {
        var shown = RambleLiveTranscript()
        shown.heardOnDevice("I'm having one cup of oats")
        #expect(shown.text == "I'm having one cup of oats")
        shown.heardOnDevice("I'm having one cup of oats and fifty grams of blue")
        shown.heardByGemini("I'm having one cup of oats.")
        #expect(shown.text == "I'm having one cup of oats. and fifty grams of blue")
        shown.heardOnDevice("I'm having one cup of oats and fifty grams of blueberries")
        shown.heardByGemini("I'm having one cup of oats. And 50 grams of blueberries.")
        #expect(shown.text == "I'm having one cup of oats. And 50 grams of blueberries.")
    }

    @Test func geminiAheadOfTheDeviceHidesNoLaterWords() {
        var shown = RambleLiveTranscript()
        shown.heardOnDevice("two eggs")
        shown.heardByGemini("Two eggs and toast.")
        shown.heardOnDevice("two eggs and toast with butter")
        #expect(shown.text == "Two eggs and toast. with butter")
    }
}
