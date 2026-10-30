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
        #expect(hours.map(\.hour) == [6, 12, 13, 14, 15])
        #expect(hours[3].rows.map(\.entry.id) == [first.id, second.id, third.id])
        #expect(hours[3].rows.map(\.showsTime) == [true, false, true])
        #expect(hours[3].totals[.energy] == 960)
        #expect(hours[0].totals[.protein] == 15)
        #expect(hours[1].rows.isEmpty)

        var hidden = timeline
        hidden.hideEmptyHours = true
        #expect(FoodLog.hours([third, early], timeline: hidden).map(\.hour) == [6, 14])
    }

    @Test func totalsAndSummarizesAgainstTheDaysTarget() {
        let entries = [entry(bowl, minute: 600), entry(yogurt, minute: 700, quantity: 2)]
        let totals = FoodLog.totals(entries)
        #expect(totals[.energy] == 660)
        #expect(totals[.protein] == 55)
        #expect(totals.amount(of: .netCarbs) == 54)

        let target = DayTarget(energy: 2000, protein: 50, fat: 70, carbs: 200)
        let shown = FoodLog.summary(totals, target: target, showOverages: true)
        #expect(shown.map(\.nutrient) == [.energy, .protein, .fat, .carbs])
        #expect(shown.map(\.consumed) == [660, 55, 22, 66])
        #expect(shown.map(\.remaining) == [1340, -5, 48, 134])
        #expect(shown.map(\.progress) == [0.33, 1, 22.0 / 70, 0.33])

        let clamped = FoodLog.summary(totals, target: target, showOverages: false)
        #expect(clamped.map(\.remaining) == [1340, 0, 48, 134])

        var edited = NutritionDay(id: monday)
        edited.override = [.energy: 1800, .protein: 120]
        let overridden = edited.totals(entries)
        #expect(overridden[.energy] == 1800)
        #expect(overridden[.protein] == 120)
        #expect(overridden[.fat] == 22)
        #expect(NutritionDay(id: monday).totals(entries) == totals)

        let untargeted = FoodLog.summary(totals, target: nil, showOverages: true)
        #expect(untargeted.map(\.remaining) == [nil, nil, nil, nil])
        #expect(untargeted.map(\.progress) == [0, 0, 0, 0])
    }

    @Test func ringsFillWithCaloriesAgainstTheTarget() {
        #expect(FoodLog.ringProgress(kcal: 500, target: 2000) == 0.25)
        #expect(FoodLog.ringProgress(kcal: 2500, target: 2000) == 1)
        #expect(FoodLog.ringProgress(kcal: 500, target: nil) == 1)
        #expect(FoodLog.ringProgress(kcal: 0, target: nil) == 0)
    }

    @Test func ranksContributorsLargestFirst() {
        let entries = [entry(bowl, minute: 600), entry(yogurt, minute: 700, quantity: 3), entry(.quickAdd([.energy: 90]), minute: 800)]
        #expect(FoodLog.contributors(entries, of: .protein).map(\.name) == ["Yogurt", "Bowl"])
        #expect(FoodLog.contributors(entries, of: .protein).map(\.amount) == [45, 25])
        #expect(FoodLog.contributors(entries, of: .energy, limit: 2).map(\.amount) == [540, 300])
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
            Relocation(ids: [breakfast.id, coffee.id], day: calendarDay("2026-10-27"), minute: 480),
            Relocation(ids: [lunch.id], day: calendarDay("2026-10-27"), minute: 750),
        ])
        #expect(FoodLog.relocations([lunch], to: .days([calendarDay("2026-11-02"), calendarDay("2026-10-30")]), now: now, calendar: calendar) == [
            Relocation(ids: [lunch.id], day: calendarDay("2026-10-30"), minute: 750),
            Relocation(ids: [lunch.id], day: calendarDay("2026-11-02"), minute: 750),
        ])
        #expect(FoodLog.relocations([lunch], to: .hour(monday, hour: 15), now: now, calendar: calendar) == [
            Relocation(ids: [lunch.id], day: monday, minute: 900),
        ])
    }

    @Test func confirmsWhatWasCopiedOrMovedAndWhere() {
        let now = monday.date(atMinute: 18 * 60 + 5, in: utc)
        func message(_ action: FoodLogState.Action, _ count: Int, _ target: PasteTarget) -> String {
            FoodLog.confirmation(action, count: count, to: target, now: now, calendar: utc)
        }
        #expect(message(.copy, 3, .today) == "Copied 3 foods to Today")
        #expect(message(.move, 1, .tomorrow) == "Moved 1 food to Tomorrow")
        #expect(message(.copy, 2, .now) == "Copied 2 foods to Today at 6:05 PM")
        #expect(message(.copy, 2, .days([monday.adding(days: 3)])) == "Copied 2 foods to Thu, Oct 29")
        #expect(message(.copy, 5, .days([monday, monday.adding(days: 1), monday.adding(days: 2)])) == "Copied 5 foods to 3 days")
        #expect(message(.copy, 2, .dateTime(monday.adding(days: 1), minute: 900)) == "Copied 2 foods to Tomorrow at 3 PM")
        #expect(message(.move, 1, .dateTime(monday, minute: 11 * 60)) == "Moved 1 food to Today at 11 AM")
        #expect(message(.move, 1, .dateTime(monday, minute: 8 * 60 + 30)) == "Moved 1 food to Today at 8:30 AM")
        #expect(message(.move, 3, .hour(monday.adding(days: -1), hour: 16)) == "Moved 3 foods to Yesterday at 4 PM")
    }

    @Test func aMomentDropsTheMinutesOnTheHour() {
        #expect(NutritionFormat.moment(0) == "12 AM")
        #expect(NutritionFormat.moment(8 * 60) == "8 AM")
        #expect(NutritionFormat.moment(8 * 60 + 30) == "8:30 AM")
        #expect(NutritionFormat.moment(12 * 60) == "12 PM")
        #expect(NutritionFormat.moment(23 * 60 + 5) == "11:05 PM")
    }

    @Test func anHourPillAddsItsEntriesOrTakesThemAllBack() {
        let a = UUID(), b = UUID(), c = UUID()
        #expect(FoodLog.toggling([a, b], in: [c]) == [a, b, c])
        #expect(FoodLog.toggling([a, b], in: [a, c]) == [a, b, c])
        #expect(FoodLog.toggling([a, b], in: [a, b, c]) == [c])
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
        #expect(FoodLog.totals(half.map { FoodEntry($0, day: monday, minute: 0) })[.energy]?.rounded() == 306)
    }

    @Test func draftsARecipeFromTheSelectionAtItsLoggedServings() {
        let draft = FoodLog.recipeDraft([entry(bowl, minute: 600, quantity: 2), entry(yogurt, minute: 610, quantity: 0.5)])
        #expect(draft.name == "")
        #expect(draft.servings == "1")
        #expect(draft.ingredients.map(\.value.food.name) == ["Bowl", "Yogurt"])
        #expect(draft.ingredients.map(\.quantity) == ["2", "0.5"])
        #expect(draft.preview.nutrition.nutrients[.energy] == 690)
    }

    @Test func findsTheLastEntryAddedToTheDay() {
        let breakfast = entry(bowl, minute: 480)
        let lunch = entry(bowl, minute: 750)
        let snack = entry(yogurt, minute: 900)
        #expect(FoodLog.added(from: [breakfast], to: [breakfast, lunch, snack]) == snack.id)
        #expect(FoodLog.added(from: [breakfast, snack], to: [breakfast, lunch, snack]) == lunch.id)
        #expect(FoodLog.added(from: [breakfast, lunch], to: [breakfast]) == nil)
        #expect(FoodLog.added(from: [], to: []) == nil)
    }

    @Test func foldsTheWeekStripOnlyWhenScrolledThroughALongDay() {
        #expect(FoodLog.collapsesStrip(offset: 0, slack: 600) == false)
        #expect(FoodLog.collapsesStrip(offset: 60, slack: 600) == true)
        #expect(FoodLog.collapsesStrip(offset: 60, slack: 80) == nil)
        #expect(FoodLog.collapsesStrip(offset: 25, slack: 600) == nil)
    }

    @Test func scalesBarsSoTheTargetSitsAtSixtyPercent() {
        #expect(FoodLog.barMaximum(value: 50, range: NutrientRange(target: 120)) == 200)
        #expect(FoodLog.barMaximum(value: 300, range: NutrientRange(target: 120)) == 300)
        #expect(FoodLog.barMaximum(value: 10, range: NutrientRange(ceiling: 30)) == 50)
        #expect(FoodLog.barMaximum(value: 10, range: NutrientRange()) == nil)
    }

    @Test func convertsServingsKeepingTheAmountEaten() {
        let container = Serving(measure: yogurt.nutrition.measures[0], quantity: 2)
        let grams = yogurt.nutrition.allMeasures.first { $0.name == "g" }!
        let ounces = yogurt.nutrition.allMeasures.first { $0.name == "oz" }!
        #expect(NutritionFormat.quantity(container.converted(to: grams).quantity) == "300")
        #expect(NutritionFormat.quantity(container.converted(to: ounces).quantity) == "10.58")
        let pounds = yogurt.nutrition.allMeasures.first { $0.name == "lb" }!
        let back = container.converted(to: pounds).converted(to: yogurt.nutrition.measures[0])
        #expect(abs(back.quantity - 2) < 1e-9)
        #expect(calendarDay("2026-10-26").days(to: calendarDay("2027-01-01")) == 67)
        #expect(calendarDay("2026-10-26").days(to: calendarDay("2026-10-20")) == -6)
    }

    @Test func labelsHoursTimesServingsAndDays() {
        #expect([0, 8, 12, 21].map(NutritionFormat.hour) == ["12 AM", "8 AM", "12 PM", "9 PM"])
        #expect([5, 168, 768, 1187].map(NutritionFormat.time) == ["12:05", "2:48", "12:48", "7:47"])
        #expect(NutritionFormat.clock(888) == "2:48 PM")
        #expect(NutritionFormat.serving(Serving(measure: Measure(name: "cup", quantity: 1, servings: 2.4), quantity: 1.25)) == "1.25 cup")
        #expect(NutritionFormat.serving(Serving(measure: Measure(name: "g", quantity: 1, servings: 0.01), quantity: 150)) == "150 g")
        #expect(NutritionFormat.quantity(1.0 / 3) == "0.33")
        #expect(NutritionFormat.macros([.energy: 199.6, .protein: 12, .fat: 8.4, .carbs: 19.5]) == "12P 8F 20C")
        #expect(NutritionFormat.dayTitle(monday, today: monday) == "Today")
        #expect(NutritionFormat.dayTitle(monday, today: monday.adding(days: 1)) == "Yesterday")
        #expect(NutritionFormat.dayTitle(monday, today: monday.adding(days: -1)) == "Tomorrow")
        #expect(NutritionFormat.dayTitle(monday, today: monday.adding(days: 5)) == "Mon, Oct 26")
        #expect(NutritionFormat.shortDay(monday) == "Oct 26")
        #expect(monday.date(atMinute: 888, in: utc).minuteOfDay(in: utc) == 888)
        #expect(NutritionDay.Status.allCases.map(\.title) == ["Complete", "Incomplete", "Fasted"])
        #expect(calendarDay("2026-10-29").week.map(\.description) == [
            "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01",
        ])
    }
}
