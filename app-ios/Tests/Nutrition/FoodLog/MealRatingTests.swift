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
        let tiers = [(120, 20), (130, 20), (160, 20), (200, 20), (260, 20), (280, 20)].map { score(Double($0), Double($1))?.tier }
        #expect(tiers == [.excellent, .great, .great, .good, .fair, .poor])
        #expect(score(205, 20)?.tier == .good)
    }

    @Test func addsTheSkullPastTwentyToOne() {
        #expect(score(400, 20)?.isDire == false)
        #expect(score(420, 20)?.isDire == true)
        #expect(score(420, 20)?.tier == .poor)
    }

    @Test func runsTheBorderOnTheTwoBestTiersAndTheSkull() {
        let animated = [(120, 20), (160, 20), (200, 20), (260, 20), (400, 20), (420, 20), (250, 0)].map { calories, protein in
            score(Double(calories), Double(protein)).map { $0.tier.isAnimated(dire: $0.isDire) }
        }
        #expect(animated == [true, true, false, false, false, true, true])
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

    /// Suspending the app completes every animation that is removed on completion, which stopped the running border
    /// of a meal still on screen when the owner came back to the app (feedback 2026-11-12).
    @MainActor @Test func theRunningBorderTurnsInAWindowAndSurvivesSuspension() throws {
        let border = RunningBorderView(frame: CGRect(x: 0, y: 0, width: 60, height: 22))
        let gradient = try #require(border.layer.sublayers?.first)
        #expect(gradient.animation(forKey: "spin") == nil)

        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 200, height: 200))
        window.addSubview(border)
        let spin = try #require(gradient.animation(forKey: "spin"))
        #expect(spin.repeatCount == .infinity)
        #expect(!spin.isRemovedOnCompletion)

        border.removeFromSuperview()
        #expect(gradient.animation(forKey: "spin") == nil)
    }
}
