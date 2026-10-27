import Testing
@testable import App

struct FoodIconTests {
    @Test func aStoredIconDrawsByNameOrAsItsEmoji() {
        #expect(FoodIconChoice.emoji(icon: "banana", name: "Anything") == "🍌")
        #expect(FoodIconChoice.emoji(icon: "🥣", name: "Oatmeal") == "🥣")
        #expect(FoodIconChoice.emoji(icon: "☕️", name: nil) == "☕️")
        #expect(FoodIconChoice.emoji(icon: "not-an-icon", name: nil) == nil)
        #expect(FoodIconChoice.emoji(icon: nil, name: nil) == nil)
    }

    @Test func otherwiseTheNameChoosesIt() {
        let names = [
            "Bananas, raw", "Chicken, broilers or fryers, breast, meat only, cooked, roasted", "Pepper, banana, raw", "Banana bread",
            "Peanut butter, smooth style", "Ice creams, vanilla", "Potatoes, baked, flesh and skin", "Greek Yogurt",
            "Beverages, coffee, brewed", "Fish, salmon, Atlantic, farmed", "Almonds", "Oatmeal", "White Rice, Cooked",
            "Cookies, chocolate chip", "Spices, garam masala",
        ]
        #expect(names.map { FoodIconChoice.emoji(icon: nil, name: $0) } == [
            "🍌", "🍗", "🫑", "🍞", "🥜", "🍨", "🥔", "🥛", "☕️", "🐟", "🥜", "🥣", "🍚", "🍪", nil,
        ])
    }
}
