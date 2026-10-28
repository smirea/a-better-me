import Foundation

/// The Nutrition half's settings, encoded whole into `settings.nutrition` and read over these defaults, so a new
/// setting needs no migration. The one Settings screen edits them beside the Workouts settings.
struct NutritionSettings: Codable, Hashable, Sendable {
    enum EnergyUnit: String, Codable, Sendable { case kcal, kj }
    /// Height and tape measurements; both are stored in centimeters.
    enum HeightUnit: String, Codable, Sendable { case feetAndInches, centimeters }

    struct Timeline: Codable, Hashable, Sendable {
        /// The hours always shown, inclusive; hours with entries outside them still show.
        var firstHour = 8
        var lastHour = 21
        var hideEmptyHours = false
        /// Food tiles show only their names.
        var hideFoodDetails = false
        var hourlyTotals = true
        var foodTimestamps = true
        var addFoodsToHour = AddFoodsToHour.plusIcon
        var calendarWeekBanner = CalendarWeekBanner.show
        /// The Move shortcut shows beside each hour as soon as a food is selected.
        var premove = false

        /// The hour's + adds food there, or long-pressing its pill does and the + is gone.
        enum AddFoodsToHour: String, Codable, Sendable { case plusIcon, longPress }
        /// The week strip folds away while the timeline is scrolled down, stays, or is never shown.
        enum CalendarWeekBanner: String, Codable, Sendable { case show, showAndPin, hide }
    }

    struct Logger: Codable, Hashable, Sendable {
        var bannerNutrients: [NutrientID] = [.energy, .protein]
        var nutritionDisplay = NutritionDisplay.remainingAfterPlate
        var timeSelection = TimeSelection.datePicker
        var optimization = Optimization.speed

        enum NutritionDisplay: String, Codable, CaseIterable, Sendable {
            case plateOnly, dayAndPlate, remainingAfterPlate

            func cycled(by step: Int) -> Self {
                let all = Self.allCases
                return all[(all.firstIndex(of: self)! + step + all.count) % all.count]
            }
        }
        enum TimeSelection: String, Codable, Sendable { case datePicker, timePad }
        /// Speed opens a tapped search result's detail with the keypad; context closes search and shows the plate.
        enum Optimization: String, Codable, Sendable { case speed, context }
    }

    struct Expenditure: Codable, Hashable, Sendable {
        /// A fixed daily expenditure in kcal instead of the computed one.
        var staticKcal: Double?
        /// The owner's own starting estimate in place of the BMR one.
        var initialKcal: Double?
        /// The first day expenditure is calculated from; nil starts at the first logged day.
        var calculationStart: CalendarDay?
        var bmrEquation = BMREquation.macroFactor
        var activity: Activity?
        var exercise: Exercise?
        var athleticPursuits: AthleticPursuits?
        var priorWeight: PriorWeight?
        var priorProgress: PriorProgress?
        var algorithm = Algorithm.v3
        var stepInformedUpdates = false
        var predictiveGoalAdjustment = false

        enum BMREquation: String, Codable, Sendable { case macroFactor, cunningham }
        /// Daily steps: under 5,000, 5,000 to 15,000, over 15,000.
        enum Activity: String, Codable, Sendable { case mostlySedentary, moderatelyActive, veryActive }
        /// Exercise sessions a week.
        enum Exercise: String, Codable, Sendable { case zero, oneToThree, fourToSix, sevenPlus }
        enum AthleticPursuits: String, Codable, Sendable { case exerciseRegularly, athlete, professionalAthlete, noneOfTheAbove }
        enum PriorWeight: String, Codable, Sendable { case yes, no, notSure }
        enum PriorProgress: String, Codable, Sendable { case gaining, losing, stable, notSure }
        enum Algorithm: String, Codable, Sendable { case v1, v2, v3 }
    }

    /// The optional check-in modules; Introduction and Program Update always show.
    struct CoachingModules: Codable, Hashable, Sendable {
        var partialLogging = true
        var weighIn = false
        var fasting = false
        var loggingBreak = false
    }

    /// Display only: every stored energy is kcal.
    var energyUnit = EnergyUnit.kcal
    var heightUnit = HeightUnit.feetAndInches
    /// ISO weekday, Monday 1.
    var checkInWeekday = 1
    /// Skips the check-in's optional modules and goes straight to the program update.
    var fastCheckIn = false
    var coachingModules = CoachingModules()
    /// The coached programs' Standard Floor. MacroFactor individualizes it by an unpublished rule; the help's figure
    /// is 1200 kcal. The Low Floor is two thirds of it.
    var standardFloorKcal = 1200
    /// Remaining amounts go negative past a target instead of stopping at zero.
    var showOverages = true
    /// Shown first, in this order, on the Dashboard and in food details.
    var pinnedNutrients: [NutrientID] = [.energy, .protein, .fat, .carbs]
    var hideAdditionalNutrients = false
    var searchBranded = true
    /// Measure names pinned to the front of the serving picker, at most two weights and two volumes.
    var favoriteMeasures = ["g", "oz", "mL", "cup"]
    var timeline = Timeline()
    var logger = Logger()
    /// The Nutrition "+" sheet's shortcuts in order; the first four are its round buttons.
    var shortcuts = NutritionShortcut.defaults
    var expenditure = Expenditure()
    /// Hidden from the Dashboard and summaries; totals still count them. Calories and the macros always show.
    var hiddenNutrients: Set<NutrientID> = []
    /// The tape measurements the Dashboard and editors offer; scale weight and visual body fat always show.
    var visibleBodyMetrics: Set<BodyMetricKind> = []
    /// Foods swiped out of an hour's Picks (`HourPicks`), by `FoodSearchResult.key`.
    var hiddenPicks: [Int: Set<String>] = [:]
}
