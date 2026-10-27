import Testing
@testable import App

struct FoodTextTests {
    func bold(_ name: String, _ query: String) -> [String] {
        FoodText.matches(in: name, terms: FoodText.terms(query)).map { String(name[$0]) }
    }

    @Test func matchedWordsAndPrefixesAreTheBoldParts() {
        #expect(bold("Bananas, raw", "banana") == ["Bananas"])
        #expect(bold("Bananas, raw", "ban") == ["Ban"])
        #expect(bold("Pepper, banana, raw", "bananas raw") == ["banana", "raw"])
        #expect(bold("Nonfat Greek Yogurt By Chobani", "chob gree") == ["Gree", "Chob"])
        #expect(bold("Cookies, chocolate chip", "cookie") == ["Cookies"])
        #expect(bold("Eggplant, raw", "egg") == ["Egg"])
        #expect(bold("Crème brûlée", "creme") == ["Crème"])
        #expect(bold("Milk, 2% fat", "2%") == ["2%"])
        #expect(bold("Bananas, raw", "").isEmpty)
        #expect(bold("Bananas, raw", "apple").isEmpty)
    }
}
