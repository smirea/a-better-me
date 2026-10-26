import Foundation
import Testing
@testable import App

func calendarDay(_ text: String) -> CalendarDay { CalendarDay(text)! }

/// 120 kcal, 10 g protein, 4 g fat, 12 g carbs, and 2 g fiber per 100 g; a container is 150 g.
let yogurt = FoodSnapshot(
    foodID: "usda-171304", source: .usda, name: "Yogurt", brand: nil,
    nutrition: FoodNutrition(
        nutrients: [.energy: 120, .protein: 10, .fat: 4, .carbs: 12, .fiber: 2], baseGrams: 100,
        measures: [Measure(name: "container", quantity: 1, servings: 1.5)]
    )
)

struct NutritionModelTests {
    @Test func calendarDaysParseStrictlyAndCountInIsoWeekdays() {
        #expect(CalendarDay("2026-02-30") == nil)
        #expect(CalendarDay("2026-1-05") == nil)
        #expect(CalendarDay("2026-10-26T00:00") == nil)
        #expect(calendarDay("2026-10-26").weekday == 1)
        #expect(calendarDay("2026-11-01").weekday == 7)
        #expect(calendarDay("2026-12-31").adding(days: 1).description == "2027-01-01")
        #expect(calendarDay("2026-03-01").adding(days: -1).description == "2026-02-28")
        #expect(calendarDay("2026-09-30") < calendarDay("2026-10-01"))
    }

    @Test func aServingScalesTheBaseNutrientsByItsServings() {
        let container = FoodPortion(yogurt)
        #expect(container.serving.servings == 1.5)
        #expect(container.amounts == [.energy: 180, .protein: 15, .fat: 6, .carbs: 18, .fiber: 3])

        let grams = yogurt.nutrition.allMeasures.first { $0.name == "g" }!
        let half = FoodPortion(yogurt, serving: Serving(measure: grams, quantity: 50))
        #expect(half.amounts[.energy] == 60)
        #expect(yogurt.nutrition.allMeasures.map(\.name) == ["container", "g", "oz", "lb"])
    }

    @Test func netCarbsAreDerivedUnlessReported() {
        #expect(yogurt.nutrition.nutrients.amount(of: .netCarbs) == 10)
        #expect(([.carbs: 12, .fiber: 2, .netCarbs: 7] as NutrientAmounts).amount(of: .netCarbs) == 7)
        #expect(([.fiber: 2] as NutrientAmounts).amount(of: .netCarbs) == nil)
    }

    @Test func aRecipeIsItsIngredientsDividedIntoItsServings() {
        var recipe = Recipe(name: "Bowl", servings: 4)
        recipe.cookedGrams = 800
        let grams = yogurt.nutrition.allMeasures.first { $0.name == "g" }!
        recipe.ingredients = [
            RecipeIngredient(FoodPortion(yogurt, serving: Serving(measure: grams, quantity: 200))),
            RecipeIngredient(FoodPortion(.quickAdd([.energy: 160, .protein: 4]))),
        ]
        let nutrition = recipe.nutrition
        #expect(nutrition.nutrients == [.energy: 100, .protein: 6, .fat: 2, .carbs: 6, .fiber: 1])
        #expect(nutrition.baseGrams == 200)
        #expect(recipe.snapshot.source == .recipe)
        #expect(recipe.snapshot.foodID == recipe.key)
    }

    @Test func aDayCountsAsLoggedFastedOrSkipped() {
        let day = calendarDay("2026-10-26")
        let entry = FoodEntry(FoodPortion(yogurt), day: day, minute: 8 * 60)
        var marked = NutritionDay(id: day)

        #expect(DayIntake(entries: [entry], day: nil).energy == 180)
        #expect(DayIntake(entries: [], day: nil) == .skipped)
        marked.status = .fasted
        #expect(DayIntake(entries: [], day: marked).energy == 0)
        #expect(DayIntake(entries: [entry], day: marked).energy == 180)
        marked.status = .partial
        #expect(DayIntake(entries: [entry], day: marked) == .skipped)
        marked.override = [.energy: 2100]
        #expect(DayIntake(entries: [entry], day: marked) == .logged([.energy: 2100]))
    }

    @Test func aDayTakesTheLatestPlanStartingOnOrBeforeIt() {
        let goal = NutritionGoal(kind: .lose, targetWeightKg: 75, ratePercentPerWeek: -0.5, startedOn: calendarDay("2026-10-05"))
        var week = WeekTargets(every: DayTarget(energy: 2200, protein: 160, fat: 70, carbs: 230))
        week[6] = DayTarget(energy: 2600, protein: 160, fat: 80, carbs: 300)
        let first = NutritionPlan(from: calendarDay("2026-10-05"), kind: .setup, goal: goal, coaching: CoachingProgram(), targets: week)
        let second = NutritionPlan(
            from: calendarDay("2026-10-19"), kind: .checkIn, goal: goal, coaching: CoachingProgram(),
            targets: WeekTargets(every: DayTarget(energy: 2100, protein: 160, fat: 65, carbs: 220))
        )

        #expect(NutritionPlan.effective(on: calendarDay("2026-10-04"), in: [first, second]) == nil)
        let saturday = calendarDay("2026-10-17")
        #expect(NutritionPlan.effective(on: saturday, in: [second, first])?.target(on: saturday).energy == 2600)
        #expect(NutritionPlan.effective(on: calendarDay("2026-10-19"), in: [first, second])?.id == second.id)
    }

    @Test func aNutrientGoalFallsBackToTheRegistryDefaults() {
        let vitaminC: NutrientID = "401"
        let custom = NutrientGoal(vitaminC, from: calendarDay("2026-10-10"), mode: .custom(NutrientRange(floor: 60, target: 200, ceiling: nil)))
        let backToAuto = NutrientGoal(vitaminC, from: calendarDay("2026-10-20"), mode: .auto)
        let goals = [custom, backToAuto]

        #expect(NutrientGoal.range(vitaminC, on: calendarDay("2026-10-09"), goals: goals, sex: .male, weightKg: nil) == NutrientRange(target: 90, ceiling: 2000))
        #expect(NutrientGoal.range(vitaminC, on: calendarDay("2026-10-15"), goals: goals, sex: .male, weightKg: nil) == NutrientRange(floor: 60, target: 200))
        #expect(NutrientGoal.range(vitaminC, on: calendarDay("2026-10-20"), goals: goals, sex: .female, weightKg: nil) == NutrientRange(target: 75, ceiling: 2000))
        let lysine = NutrientGoal.range("505", on: calendarDay("2026-10-20"), goals: [], sex: .male, weightKg: 80)
        #expect(lysine == NutrientRange(target: 3.04))
    }

    @Test func theRegistryListsMacroFactorsNutrientsByGroup() {
        let all = NutrientRegistry.all
        #expect(all.count == 56)
        #expect(Set(all.map(\.id)).count == 56)
        #expect(all.prefix(4).map(\.id.rawValue) == ["k", "221", "262", "255"])
        #expect(NutrientGroup.allCases.map { group in all.first { $0.group == group }!.id.rawValue } == ["k", "p", "c", "f", "417", "301"])
        #expect(NutrientRegistry.nutrient("418")?.unit == .mcg)
        #expect(NutrientRegistry.nutrient("307")?.defaults?.female == NutrientRange(target: 1500, ceiling: 2300))
    }

    /// The same text is the fixture `shared/db/schema.test.ts` runs the server's validators over.
    @Test func dataColumnsEncodeAsTheServerValidatorsExpect() throws {
        let portion = FoodPortion(yogurt)
        #expect(try RowJSON.text(portion.food) == #"{"foodID":"usda-171304","name":"Yogurt","nutrition":{"baseGrams":100,"measures":[{"name":"container","quantity":1,"servings":1.5}],"nutrients":{"291":2,"c":12,"f":4,"k":120,"p":10}},"source":"usda"}"#)
        #expect(try RowJSON.text(portion.serving) == #"{"measure":{"name":"container","quantity":1,"servings":1.5},"quantity":1}"#)
        #expect(try RowJSON.text(WeekTargets(every: DayTarget(energy: 2000, protein: 150, fat: 70, carbs: 200))).hasPrefix(#"[{"carbs":200,"energy":2000,"fat":70,"protein":150},"#))
        let goal = NutritionGoal(kind: .gain, ratePercentPerWeek: 0.25, startedOn: calendarDay("2026-10-26"))
        #expect(try RowJSON.text(goal) == #"{"kind":"gain","ratePercentPerWeek":0.25,"startedOn":"2026-10-26"}"#)
        #expect(try RowJSON.text(CoachingProgram()) == #"{"diet":"balanced","floor":"standard","highDays":[],"protein":"moderate","style":"coached","training":"lifting"}"#)
    }
}
