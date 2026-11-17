import Foundation
import Testing
@testable import App

/// The Food Log's grouping, totals, remaining amounts, relocations, and labels.
struct FoodLogMathTests {
    let monday = calendarDay("2026-10-26")

    /// 300 kcal, 25 g protein, 10 g fat, 30 g carbs, and 6 g fiber per serving.
    let bowl = FoodSnapshot(
        source: .custom, name: "Bowl",
        nutrition: FoodNutrition(nutrients: [.energy: 300, .protein: 25, .fat: 10, .carbs: 30, .fiber: 6], measures: [Measure(name: "bowl", quantity: 1, servings: 1)])
    )

    func entry(_ food: FoodSnapshot, minute: Int, quantity: Double = 1, day: CalendarDay? = nil, loggedAt seconds: TimeInterval = 0) -> FoodEntry {
        FoodEntry(
            FoodPortion(food, serving: Serving(measure: food.nutrition.measures[0], quantity: quantity)),
            day: day ?? monday, minute: minute, at: Date(timeIntervalSince1970: 1_800_000_000 + seconds)
        )
    }

    @Test func groupsEntriesByHourOverTheConfiguredRange() {
        let early = entry(yogurt, minute: 6 * 60 + 30)
        let first = entry(bowl, minute: 14 * 60 + 48, loggedAt: 1)
        let second = entry(yogurt, minute: 14 * 60 + 48, quantity: 2, loggedAt: 2)
        let third = entry(bowl, minute: 14 * 60 + 50, loggedAt: 0)
        let timeline = NutritionSettings.Timeline(firstHour: 12, lastHour: 15)

        let hours = FoodLog.hours([third, second, early, first], timeline: timeline)
        #expect(hours.map(\.slot) == [.hour(6), .hour(12), .hour(13), .hour(14), .hour(15)])
        #expect(hours[3].rows.map(\.entry.id) == [first.id, second.id, third.id])
        #expect(hours[3].rows.map(\.showsTime) == [true, false, true])
        #expect(hours[3].totals[.energy] == 960)
        #expect(hours[0].totals[.protein] == 15)
        #expect(hours[1].rows.isEmpty)

        var hidden = timeline
        hidden.hideEmptyHours = true
        #expect(FoodLog.hours([third, early], timeline: hidden).map(\.slot) == [.hour(6), .hour(14)])
    }

    @Test func totalsAndSummarizesAgainstTheDaysTarget() {
        let entries = [entry(bowl, minute: 600), entry(yogurt, minute: 700, quantity: 2)]
        let totals = entries.totals
        #expect(totals[.energy] == 660)
        #expect(totals[.protein] == 55)
        #expect(totals.amount(of: .netCarbs) == 54)

        let target = DayTarget(energy: 2000, protein: 50, fat: 70, carbs: 200)
        let shown = FoodLog.summary(totals, targets: target.amounts, showOverages: true)
        #expect(shown.map(\.nutrient) == [.energy, .protein, .fat, .carbs])
        #expect(shown.map(\.consumed) == [660, 55, 22, 66])
        #expect(shown.map(\.remaining) == [1340, -5, 48, 134])
        #expect(shown.map { $0.fill(.eaten) } == [
            MacroLine.Fill(eaten: 0.33, plate: 0), MacroLine.Fill(eaten: 1, plate: 0),
            MacroLine.Fill(eaten: 22.0 / 70, plate: 0), MacroLine.Fill(eaten: 0.33, plate: 0),
        ])
        #expect(shown.map { $0.text(.eaten) } == ["660 / 2,000", "55 / 50", "22 / 70", "66 / 200"])
        #expect(shown.map { $0.text(.remaining) } == ["1,340 left", "-5 left", "48 left", "134 left"])

        let clamped = FoodLog.summary(totals, targets: target.amounts, showOverages: false)
        #expect(clamped.map(\.remaining) == [1340, 0, 48, 134])

        var edited = NutritionDay(id: monday)
        edited.override = [.energy: 1800, .protein: 120]
        let overridden = edited.totals(entries)
        #expect(overridden[.energy] == 1800)
        #expect(overridden[.protein] == 120)
        #expect(overridden[.fat] == 22)
        #expect(NutritionDay(id: monday).totals(entries) == totals)

        let untargeted = FoodLog.summary(totals, targets: [:], showOverages: true)
        #expect(untargeted.map(\.remaining) == [nil, nil, nil, nil])
        #expect(untargeted.map { $0.fill(.eaten) } == [nil, nil, nil, nil])
        #expect(untargeted.map { $0.text(.remaining) } == ["660", "55", "22", "66"])
    }

    @Test func averagesOnlyTheDaysTheAlgorithmCounts() {
        let tuesday = monday.adding(days: 1)
        let wednesday = monday.adding(days: 2)
        let thursday = monday.adding(days: 3)
        let friday = monday.adding(days: 4)
        let entries = [
            entry(bowl, minute: 600, day: monday),
            entry(bowl, minute: 600, quantity: 3, day: tuesday),
            entry(bowl, minute: 600, quantity: 5, day: thursday),
        ]
        var fasted = NutritionDay(id: wednesday)
        fasted.status = .fasted
        var partial = NutritionDay(id: thursday)
        partial.status = .partial

        let average = FoodLog.dailyAverage(entries, rows: [fasted, partial], days: [monday, tuesday, wednesday, thursday, friday])
        #expect(average[.energy] == 400)
        #expect(average[.protein] == 100.0 / 3)
        #expect(FoodLog.dailyAverage([], rows: [], days: [monday]) == [:])
    }

    @Test func relocatesKeepingOrSettingTimes() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/New_York")!
        let now = calendar.date(from: DateComponents(year: 2026, month: 10, day: 26, hour: 18, minute: 5))!
        let breakfast = entry(bowl, minute: 480, day: calendarDay("2026-10-20"))
        let coffee = entry(yogurt, minute: 480, day: calendarDay("2026-10-20"))
        let lunch = entry(bowl, minute: 750, day: calendarDay("2026-10-20"))
        let entries = [lunch, breakfast, coffee]

        #expect(FoodLog.relocations(entries, to: .now, now: now, calendar: calendar) == [
            Relocation(ids: [lunch.id, breakfast.id, coffee.id], day: monday, minute: 1085),
        ])
        #expect(FoodLog.relocations(entries, to: .tomorrow, now: now, calendar: calendar) == [
            Relocation(ids: [breakfast.id, coffee.id], day: calendarDay("2026-10-27"), minute: 480, section: .keep),
            Relocation(ids: [lunch.id], day: calendarDay("2026-10-27"), minute: 750, section: .keep),
        ])
        #expect(FoodLog.relocations([lunch], to: .days([calendarDay("2026-11-02"), calendarDay("2026-10-30")]), now: now, calendar: calendar) == [
            Relocation(ids: [lunch.id], day: calendarDay("2026-10-30"), minute: 750, section: .keep),
            Relocation(ids: [lunch.id], day: calendarDay("2026-11-02"), minute: 750, section: .keep),
        ])
        #expect(FoodLog.relocations([lunch], to: .hour(monday, hour: 15), now: now, calendar: calendar) == [
            Relocation(ids: [lunch.id], day: monday, minute: 900),
        ])
    }

    @Test func explodesARecipeIntoItsIngredientsAtTheAmountEaten() {
        let chicken = FoodSnapshot(
            source: .usda, name: "Chicken", nutrition: FoodNutrition(nutrients: [.energy: 165, .protein: 31], baseGrams: 100, measures: [Measure(name: "g", quantity: 100, servings: 1)])
        )
        let pasta = FoodSnapshot(
            source: .usda, name: "Pasta", nutrition: FoodNutrition(nutrients: [.energy: 105, .carbs: 21], baseGrams: 28.349523125, measures: [Measure(name: "oz", quantity: 1, servings: 1)])
        )
        var recipe = Recipe(name: "Chicken Pasta", servings: 2)
        recipe.ingredients = [
            RecipeIngredient(FoodPortion(chicken, serving: Serving(measure: chicken.nutrition.measures[0], quantity: 360))),
            RecipeIngredient(FoodPortion(pasta, serving: Serving(measure: pasta.nutrition.measures[0], quantity: 6))),
        ]

        let half = FoodLog.exploded(Serving(measure: Measure(name: "serving", quantity: 1, servings: 1), quantity: 0.5), of: recipe)
        #expect(half.map(\.food.name) == ["Chicken", "Pasta"])
        #expect(half.map(\.serving.quantity) == [90, 1.5])
        #expect(half.map(\.serving.measure.name) == ["g", "oz"])
        #expect(half.map { FoodEntry($0, day: monday, minute: 0) }.totals[.energy]?.rounded() == 306)
    }

    @Test func draftsARecipeFromTheSelectionAtItsLoggedServings() {
        let draft = FoodLog.recipeDraft([entry(bowl, minute: 600, quantity: 2), entry(yogurt, minute: 610, quantity: 0.5)])
        #expect(draft.name == "")
        #expect(draft.servings == "")
        #expect(draft.valid == nil)
        #expect(draft.ingredients.map(\.value.food.name) == ["Bowl", "Yogurt"])
        #expect(draft.ingredients.map(\.quantity) == ["2", "0.5"])
        #expect(draft.preview.nutrition.nutrients[.energy] == 690)
    }

    @Test func replacesTheSelectionWithTheWholeRecipeAtItsEarliestEntry() throws {
        var first = entry(yogurt, minute: 600, quantity: 0.5)
        first.section = "breakfast"
        let selection = [entry(bowl, minute: 610, quantity: 2), first, entry(bowl, minute: 620)]
        var draft = FoodLog.recipeDraft(selection)
        draft.name = "Breakfast Bowl"
        draft.servings = "1"

        let recipe = try #require(draft.valid).newRecipe()
        let single = try #require(FoodLog.replacement(for: selection, with: recipe))
        #expect(single.food.name == "Breakfast Bowl")
        #expect(single.food.source == .recipe)
        #expect(single.serving.quantity == 1)
        #expect(single.serving.measure.name == "serving")
        #expect(single.day == monday)
        #expect(single.minute == 600)
        #expect(single.section == "breakfast")
        #expect([single].totals[.energy] == selection.totals[.energy])

        draft.servings = "4"
        let batchRecipe = try #require(draft.valid).newRecipe()
        let batch = try #require(FoodLog.replacement(for: selection, with: batchRecipe))
        #expect(batch.serving.quantity == 4)
        #expect([batch].totals[.energy] == selection.totals[.energy])
    }

    @Test func countsDaysBetweenCalendarDays() {
        #expect(calendarDay("2026-10-26").days(to: calendarDay("2027-01-01")) == 67)
        #expect(calendarDay("2026-10-26").days(to: calendarDay("2026-10-20")) == -6)
    }
}
