import Foundation

extension NutritionEngine {
    /// One logged day of intake. A fasting day is logged with 0 kcal. An incomplete day is excluded from
    /// expenditure as if it were not logged. Unlogged days are simply absent.
    struct IntakeDay: Hashable {
        var date: Date
        var kcal: Double
        var isIncomplete = false
    }

    struct ExpenditureDay: Hashable {
        var date: Date
        var kcal: Double
        /// The estimate was carried over because the previous seven days had too little nutrition or weight data.
        var isHolding: Bool
    }

    /// Daily energy expenditure (TDEE) by energy balance, modeled on MacroFactor's Expenditure V3 and calibrated on
    /// the owner's export (mean error 24 kcal/day, max 130). MacroFactor publishes the loop, not the constants, so every
    /// number in `Model` is fitted, not found.
    enum Expenditure {
        struct Model {
            /// Days of intake and trend behind the estimate.
            var window = 28
            /// Share of the gap between the raw energy-balance estimate and the current estimate closed per day.
            var gain = 0.015
            var kcalPerKg = NutritionEngine.kcalPerLb / NutritionEngine.kgPerLb
            /// An update on a day needs this many logged days and weigh-ins in the seven days before it.
            var loggedDaysRequired = 3
            var weighInsRequired = 1
            var gateWindow = 7
            /// A new user's trend is shorter than `window`: the estimate updates over the trend there is once it spans
            /// this many days, closing `startupGain` of the gap per day, so the initial guess is replaced within weeks.
            var minWindow = 3
            var startupGain = 0.2
            /// Step-Informed Updates: each day the estimate moves by this many kcal per step of change in the mean daily
            /// steps of the seven days before it, so a change in activity shows before the trend can, and the loop
            /// still corrects it toward the energy balance.
            var kcalPerStep = 0.04
            var stepWindow = 7
            var stepDaysRequired = 4
            /// Predictive Goal Adjustment (macrofactor.com/expenditure-modifiers): the estimate is scaled by
            /// 1 + `goalRateFactor` × the goal's rate (percent of body weight per week, negative while losing), ramped
            /// over `goalRampDays` from each change of the rate.
            var goalRateFactor = 0.04
            var goalRampDays = 14

            static let v3 = Model()
            /// The reading of MacroFactor's help before calibration: a 21-day box, 3500 kcal/lb, and no smoothing.
            static let baseline = Model(window: 21, gain: 1, kcalPerKg: 3500 / NutritionEngine.kgPerLb)
        }

        /// What the modifiers read; empty when a modifier is off. `goalRates` holds each plan's rate from the day it starts.
        struct Modifiers: Hashable {
            var steps: [DatedValue] = []
            var goalRates: [DatedValue] = []
        }

        /// `trend` is `TrendWeight.daily`, contiguous from the first weigh-in.
        /// The estimate for a day uses data through the day before, so today's log never moves today's number.
        static func daily(
            intake: [IntakeDay], trend: [DatedValue], weighIns: [DatedValue], initial: Double,
            from start: Date, through end: Date, calendar: Calendar, model: Model = .v3, modifiers: Modifiers = Modifiers()
        ) -> [ExpenditureDay] {
            let logged = Dictionary(intake.filter { !$0.isIncomplete }.map { (calendar.startOfDay(for: $0.date), $0.kcal) }, uniquingKeysWith: { $1 })
            let trendByDay = Dictionary(trend.map { (calendar.startOfDay(for: $0.date), $0.value) }, uniquingKeysWith: { $1 })
            let weighInDays = Set(weighIns.map { calendar.startOfDay(for: $0.date) })
            // One calendar walk covers the look-back and each day reads its windows by index: stepping the calendar
            // per day and window hung Strategy's synchronous first frame.
            let lookback = max(model.window, model.gateWindow) + 1
            let days = eachDay(from: calendar.date(byAdding: .day, value: -lookback, to: calendar.startOfDay(for: start))!, through: end, calendar: calendar)
            let kcal = days.map { logged[$0] }
            let hasWeighIn = days.map { weighInDays.contains($0) }
            let trendOn = days.map { trendByDay[$0] }
            let firstTrend = trendOn.firstIndex { $0 != nil } ?? days.count
            let stepsByDay = Dictionary(modifiers.steps.map { (calendar.startOfDay(for: $0.date), $0.value) }, uniquingKeysWith: { $1 })
            let stepsOn = days.map { stepsByDay[$0] }
            let rates = modifiers.goalRates.map { (calendar.startOfDay(for: $0.date), $0.value) }.sorted { $0.0 < $1.0 }
            let rateOn = days.map { day in rates.last { $0.0 <= day }?.1 ?? 0 }
            func meanSteps(before i: Int) -> Double? {
                let values = (max(0, i - model.stepWindow)..<i).compactMap { stepsOn[$0] }
                return values.count >= model.stepDaysRequired ? values.reduce(0, +) / Double(values.count) : nil
            }
            // A moving average of the rate in force ramps each change in linearly over `goalRampDays`.
            func goalFactor(_ i: Int) -> Double {
                let span = max(0, i - model.goalRampDays + 1)...i
                return 1 + model.goalRateFactor * span.map { rateOn[$0] }.reduce(0, +) / Double(model.goalRampDays)
            }
            var estimate = initial
            var appliedGoal = 1.0
            return (lookback..<max(lookback, days.count)).map { i in
                let factor = goalFactor(i)
                estimate *= factor / appliedGoal
                appliedGoal = factor
                if model.kcalPerStep != 0, let now = meanSteps(before: i), let before = meanSteps(before: i - 1) {
                    estimate += model.kcalPerStep * (now - before)
                }
                let gate = i - model.gateWindow..<i
                let canUpdate = gate.filter { kcal[$0] != nil }.count >= model.loggedDaysRequired
                    && gate.filter { hasWeighIn[$0] }.count >= model.weighInsRequired
                let window = min(model.window, i - 1 - firstTrend)
                guard window >= model.minWindow else { return ExpenditureDay(date: days[i], kcal: estimate, isHolding: true) }
                let intakeDays = (i - window..<i).reversed().compactMap { kcal[$0] }
                if canUpdate, !intakeDays.isEmpty, let endTrend = trendOn[i - 1], let startTrend = trendOn[i - window - 1] {
                    let meanIntake = intakeDays.reduce(0, +) / Double(intakeDays.count)
                    let raw = meanIntake - (endTrend - startTrend) * model.kcalPerKg / Double(window)
                    estimate += (window < model.window ? model.startupGain : model.gain) * (raw - estimate)
                    return ExpenditureDay(date: days[i], kcal: estimate, isHolding: false)
                }
                return ExpenditureDay(date: days[i], kcal: estimate, isHolding: true)
            }
        }
    }
}
