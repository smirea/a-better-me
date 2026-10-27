import Foundation
import Testing
@testable import App

private let banana = FoodSnapshot(
    foodID: "usda-173944", source: .usda, name: "Bananas, raw",
    nutrition: FoodNutrition(
        nutrients: [.energy: 89, .protein: 1.1, .fat: 0.3, .carbs: 22.8], baseGrams: 100,
        measures: [Measure(name: "medium", quantity: 1, servings: 1.18), Measure(name: "large", quantity: 1, servings: 1.36)]
    )
)

private let milk = FoodSnapshot(
    source: .custom, name: "Milk",
    nutrition: FoodNutrition(nutrients: [.energy: 42], baseGrams: 100, baseMilliliters: 97, measures: [Measure(name: "glass", quantity: 1, servings: 2.5)])
)

struct QuantityTextTests {
    @Test(arguments: [
        ("2", 2.0), ("0.5", 0.5), (".5", 0.5), ("1.", 1.0), ("3/4", 0.75), ("1 1/2", 1.5), ("2 3/8", 2.375), ("1 ", 1.0),
    ])
    func parses(_ text: String, _ value: Double) {
        #expect(QuantityText.parse(text) == value)
    }

    @Test(arguments: ["", "/", "1/", "1/0", "1.5/2", "1 1", "1 1/2 3", "1/2/3", "a"])
    func rejects(_ text: String) {
        #expect(QuantityText.parse(text) == nil)
    }

    private func typed(_ keys: [QuantityText.Key], from start: Double = 1) -> String {
        var text = QuantityText(start)
        for key in keys {
            text.type(key)
        }
        return text.text
    }

    @Test func firstKeyReplacesTheShownValue() {
        #expect(typed([.digit(2)]) == "2")
        #expect(typed([.backspace]) == "")
        #expect(typed([.point, .digit(5)]) == "0.5")
    }

    @Test func keepsTheExactValueUntilTyped() {
        var third = QuantityText(1.0 / 3)
        #expect(third.text == "0.33")
        #expect(third.value == 1.0 / 3)
        third.type(.backspace)
        third.type(.digit(2))
        #expect(third.value == 2)
    }

    @Test func typesAMixedNumber() {
        #expect(typed([.digit(1), .space, .digit(1), .slash, .digit(2)]) == "1 1/2")
    }

    @Test func refusesKeysThatMakeNoNumber() {
        #expect(typed([.digit(1), .point, .digit(5), .point]) == "1.5")
        #expect(typed([.digit(1), .point, .slash]) == "1.")
        #expect(typed([.digit(1), .space, .space]) == "1 ")
        #expect(typed([.digit(1), .slash, .digit(2), .space]) == "1/2")
        #expect(typed([.space]) == "")
        #expect(typed([.slash]) == "")
        #expect(typed([.digit(0), .digit(7)]) == "7")
        #expect(typed(Array(repeating: .digit(9), count: 10)) == "99999999")
    }

    @Test func formatsWithAPointAndTwoDecimals() {
        #expect(QuantityText.format(1) == "1")
        #expect(QuantityText.format(1.5) == "1.5")
        #expect(QuantityText.format(1234.567) == "1234.57")
    }
}

struct ServingChoicesTests {
    @Test func favoriteUnitsTheFoodAllowsThenItsServings() {
        let choices = ServingChoices(banana.nutrition, favorites: ["g", "oz", "mL", "cup"])
        #expect(choices.units.map(\.name) == ["g", "oz"])
        #expect(choices.servings.map(\.name) == ["medium", "large"])
    }

    @Test func volumeUnitsNeedTheFoodsMilliliters() {
        let choices = ServingChoices(milk.nutrition, favorites: ["g", "oz", "mL", "cup"])
        #expect(choices.units.map(\.name) == ["g", "oz", "mL", "cup"])
    }

    @Test func keepsTheCurrentMeasureWhenItIsNotAFavorite() {
        let pound = banana.nutrition.allMeasures.first { $0.name == "lb" }!
        let choices = ServingChoices(banana.nutrition, favorites: ["g"], current: pound)
        #expect(choices.units.map(\.name) == ["g", "lb"])
    }

    @Test func convertsBetweenMeasuresKeepingTheAmount() {
        let large = Serving(measure: banana.nutrition.measures[1], quantity: 1)
        let grams = banana.nutrition.allMeasures.first { $0.name == "g" }!
        let inGrams = ServingChoices.convert(large, to: grams)
        #expect(inGrams.quantity == 136)
        let ounces = banana.nutrition.allMeasures.first { $0.name == "oz" }!
        #expect(ServingChoices.convert(large, to: ounces).quantity == 4.8)
        #expect(ServingChoices.convert(inGrams, to: banana.nutrition.measures[0]).quantity == 1.15)
    }

    @Test func scalesNutritionByTheServing() {
        let twoMedium = FoodPortion(banana, serving: Serving(measure: banana.nutrition.measures[0], quantity: 2))
        #expect(twoMedium.amounts[.energy] == 89 * 2.36)
        #expect(ServingChoices.detail(twoMedium.serving, banana.nutrition) == "medium • 236 g")
        #expect(twoMedium.serving.label == "2 medium")
    }
}

struct PlateTests {
    @Test func totalsEveryItemAtItsServing() {
        var plate = Plate()
        let first = plate.add(LoggerPick(FoodPortion(banana)))
        plate.add(LoggerPick(FoodPortion(.quickAdd([.energy: 250, .protein: 20]))))
        #expect(plate.totals[.energy] == 89 * 1.18 + 250)
        #expect(plate.totals[.protein] == 1.1 * 1.18 + 20)

        plate.setServing(Serving(measure: banana.nutrition.measures[1], quantity: 2), of: first)
        #expect(plate.totals[.energy] == 89 * 2.72 + 250)

        plate.remove(first)
        #expect(plate.totals == [.energy: 250, .protein: 20])
        #expect(plate.items.count == 1)
    }

    @Test func macroSharesSumToAHundredPercent() {
        let label: NutrientAmounts = [.energy: 346, .protein: 10, .fat: 5, .carbs: 78.75]
        #expect(label.macroShare(.protein) == 0.1)
        #expect(label.macroShare(.fat) == 0.1125)
        #expect(label.macroShare(.carbs) == 0.7875)
        #expect(NutrientAmounts().macroShare(.protein) == 0)
    }

    @Test func aDaysOverrideReplacesOnlyTheNutrientsItSets() {
        let entry = FoodEntry(FoodPortion(.quickAdd([.energy: 500, .protein: 30])), day: calendarDay("2026-10-26"), minute: 600)
        var day = NutritionDay(id: calendarDay("2026-10-26"))
        #expect(day.totals([entry, entry]) == [.energy: 1000, .protein: 60])
        day.override = [.energy: 1800]
        #expect(day.totals([entry, entry]) == [.energy: 1800, .protein: 60])
        #expect(DayIntake(entries: [entry, entry], day: day) == .logged([.energy: 1800, .protein: 60]))
        #expect(NutritionLogDay(day: day.id, entries: [entry, entry], row: day).consumed == [.energy: 1800, .protein: 60])
    }

    @Test func bannerShowsWhatThePlateLeaves() {
        let calories = BannerValue(day: 1200, plate: 500, target: 2000)
        #expect(calories.amount(.remainingAfterPlate, showOverages: true) == 300)
        #expect(calories.amount(.plateOnly, showOverages: true) == 500)
        #expect(calories.amount(.dayAndPlate, showOverages: true) == 1700)
        #expect(calories.progress == 0.85)

        let over = BannerValue(day: 1800, plate: 500, target: 2000)
        #expect(over.amount(.remainingAfterPlate, showOverages: true) == -300)
        #expect(over.amount(.remainingAfterPlate, showOverages: false) == 0)
        #expect(over.progress == 1)

        let untargeted = BannerValue(day: 100, plate: 50, target: nil)
        #expect(untargeted.amount(.remainingAfterPlate, showOverages: true) == 150)
        #expect(untargeted.progress == nil)
    }
}

struct LogTimeTests {
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/New_York")!
        return calendar
    }

    @Test func takesTheMinuteFromTheClock() {
        let at = ISO8601DateFormatter().date(from: "2026-10-26T18:37:00Z")!
        let now = LogTime.now(at, calendar: calendar)
        #expect(now == LogTime(day: calendarDay("2026-10-26"), hour: 14))
        #expect(LogTime(day: calendarDay("2026-10-25"), hour: 8).minute(at: at, calendar: calendar) == 8 * 60 + 37)
    }

    @Test func labelsTheHourAndAnotherDay() {
        let today = calendarDay("2026-10-26")
        #expect(LogTime(day: today, hour: 14).label(today: today) == "2 PM")
        #expect(LogTime(day: today, hour: 0).label(today: today) == "12 AM")
        #expect(LogTime(day: calendarDay("2026-07-31"), hour: 12).label(today: today) == "12 PM · Jul 31")
        #expect(today.adding(days: -1).relativeLabel(today: today) == "Yesterday")
        #expect(calendarDay("2026-10-24").relativeLabel(today: today) == "Sat Oct 24")
    }
}

struct QuickAddDraftTests {
    @Test func sumsTheMacros() {
        let draft = QuickAddDraft(energy: "250", protein: "20", fat: "10", carbs: "20", name: " Shake ")
        #expect(draft.macroSum == 250)
        #expect(draft.amounts == [.energy: 250, .protein: 20, .fat: 10, .carbs: 20])
        #expect(draft.portion?.food.name == "Shake")
        #expect(draft.portion?.food.source == .quickAdd)
    }

    @Test func energyDefaultsToTheMacroSum() {
        let draft = QuickAddDraft(protein: "10", alcohol: "14")
        #expect(draft.amounts == [.energy: 138, .protein: 10, .alcohol: 14])
        #expect(draft.portion?.food.name == "Quick Add")
    }

    @Test func storesKilojoulesAsKcal() {
        let draft = QuickAddDraft(energy: "836.8", unit: .kj, protein: "10")
        #expect(abs(draft.amounts![.energy]! - 200) < 1e-9)
        #expect(abs(draft.macroSum - 167.36) < 1e-9)
    }

    @Test func refusesAnEmptyOrBadForm() {
        #expect(QuickAddDraft().amounts == nil)
        #expect(QuickAddDraft(energy: "abc").amounts == nil)
        #expect(QuickAddDraft(energy: "-5").amounts == nil)
    }
}

struct SearchPolicyTests {
    @Test func asksOpenFoodFactsOnlyAfterAPauseAndTwoLetters() {
        #expect(SearchPolicy.remoteDelay(for: "ba", branded: true) == .milliseconds(400))
        #expect(SearchPolicy.remoteDelay(for: " b ", branded: true) == nil)
        #expect(SearchPolicy.remoteDelay(for: "", branded: true) == nil)
        #expect(SearchPolicy.remoteDelay(for: "banana", branded: false) == nil)
    }

    @Test(arguments: [
        ("0894700010137", "0894700010137"), ("0 89470 00101 3", "089470001013"), ("9638-5074", "96385074"),
    ])
    func readsBarcodes(_ text: String, _ barcode: String) {
        #expect(LoggerSession.barcode(text) == barcode)
    }

    @Test(arguments: ["1234567", "123456789012345", "12345abc", "", "١٢٣٤٥٦٧٨"])
    func rejectsBarcodes(_ text: String) {
        #expect(LoggerSession.barcode(text) == nil)
    }
}

struct LoggerStartTests {
    private let now = Calendar.current.date(from: DateComponents(year: 2026, month: 10, day: 26, hour: 14, minute: 37))!

    @Test func anHoursPlusLogsAtThatHour() {
        let start = LoggerStart(LogFoodRequest(day: calendarDay("2026-10-24"), minute: 9 * 60, start: .barcode), now: now)
        #expect(start.tab == .scan)
        #expect(start.time == LogTime(day: calendarDay("2026-10-24"), hour: 9))
    }

    @Test func todayFollowsTheClockAndAnotherDayTakesTheCurrentHour() {
        let today = LoggerStart(LogFoodRequest(day: calendarDay("2026-10-26")), now: now)
        #expect(today.tab == .search)
        #expect(today.time == nil)
        let yesterday = LoggerStart(LogFoodRequest(day: calendarDay("2026-10-25"), start: .library), now: now)
        #expect(yesterday.tab == .library)
        #expect(yesterday.time == LogTime(day: calendarDay("2026-10-25"), hour: 14))
    }
}
