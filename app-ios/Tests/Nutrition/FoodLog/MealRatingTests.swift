import Testing
import UIKit
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
        let tiers = [(120, 20), (140, 20), (160, 20), (240, 20), (260, 20), (280, 20), (400, 20), (420, 20)]
            .map { score(Double($0), Double($1))?.tier }
        #expect(tiers == [.excellent, .great, .good, .good, .fair, .poor, .poor, .dire])
    }

    @Test func aMealWithoutProteinIsTheWorst() {
        #expect(score(250, 0) == MealRating.Score(ratio: nil, tier: .dire))
        #expect(score(250, 0)?.ratioText == "∞")
    }

    @Test func aMealWithoutCaloriesHasNoRating() {
        #expect(score(0, 0) == nil)
        #expect(formula.score([:]) == nil)
    }
}
