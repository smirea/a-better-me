import Testing
@testable import App

/// Calories per Protein: the ratio, its tier, and the skull.
struct MealRatingTests {
    let formula = MealRating.Formula.caloriesPerProtein

    func score(_ calories: Double, _ protein: Double) -> MealRating.Score? {
        formula.score([.energy: calories, .protein: protein, .fat: 3])
    }

    @Test func roundsTheRatioToAWholeNumber() {
        #expect(score(100, 8)?.ratioText == "13:1")
        #expect(score(100, 8)?.tier == .fair)
        #expect(score(130, 25)?.ratioText == "5:1")
        #expect(score(403.4, 27.6)?.ratioText == "14:1")
    }

    @Test func gradesEachTierAtItsBounds() {
        let tiers = [(120, 20), (130, 20), (160, 20), (200, 20), (260, 20), (280, 20)].map { score(Double($0), Double($1))?.tier }
        #expect(tiers == [.excellent, .great, .great, .good, .fair, .poor])
        #expect(score(205, 20)?.tier == .good)
    }

    @Test func addsTheSkullPastTwentyToOne() {
        #expect(score(400, 20)?.isDire == false)
        #expect(score(420, 20)?.isDire == true)
        #expect(score(420, 20)?.tier == .poor)
    }

    @Test func aMealWithoutProteinIsTheWorst() {
        #expect(score(250, 0) == MealRating.Score(ratio: nil, tier: .poor, isDire: true))
        #expect(score(250, 0)?.ratioText == "∞")
    }

    @Test func aMealWithoutCaloriesHasNoRating() {
        #expect(score(0, 0) == nil)
        #expect(formula.score([:]) == nil)
    }

    @Test func namesEachTiersRange() {
        #expect(MealRating.Tier.allCases.map(formula.range) == ["≤6:1", "7–8:1", "9–10:1", "11–13:1", ">13:1"])
    }
}
