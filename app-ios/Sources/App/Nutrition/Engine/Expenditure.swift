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
            /// Energy of a kilogram of weight change. 3000 kcal/lb fit best; the 3500 kcal/lb rule assumes a leaner change.
            var kcalPerKg = 3000 / NutritionEngine.kgPerLb
            /// An update on a day needs this many logged days and weigh-ins in the seven days before it.
            var loggedDaysRequired = 3
            var weighInsRequired = 1
            var gateWindow = 7

            static let v3 = Model()
            /// The reading of MacroFactor's help before calibration: a 21-day box, 3500 kcal/lb, and no smoothing.
            static let baseline = Model(window: 21, gain: 1, kcalPerKg: 3500 / NutritionEngine.kgPerLb)
        }

        /// `trend` is `TrendWeight.daily` and must cover `window` days before `start`; a day it does not cover holds.
        /// The estimate for a day uses data through the day before, so today's log never moves today's number.
        static func daily(
            intake: [IntakeDay], trend: [DatedValue], weighIns: [DatedValue], initial: Double,
            from start: Date, through end: Date, calendar: Calendar, model: Model = .v3
        ) -> [ExpenditureDay] {
            let logged = Dictionary(intake.filter { !$0.isIncomplete }.map { (calendar.startOfDay(for: $0.date), $0.kcal) }, uniquingKeysWith: { $1 })
            let trendByDay = Dictionary(trend.map { (calendar.startOfDay(for: $0.date), $0.value) }, uniquingKeysWith: { $1 })
            let weighInDays = Set(weighIns.map { calendar.startOfDay(for: $0.date) })
            func daysBack(_ day: Date, _ count: Int) -> [Date] {
                (1...count).map { calendar.startOfDay(for: calendar.date(byAdding: .day, value: -$0, to: day)!) }
            }
            var estimate = initial
            return eachDay(from: start, through: end, calendar: calendar).map { day in
                let gate = daysBack(day, model.gateWindow)
                let canUpdate = gate.filter { logged[$0] != nil }.count >= model.loggedDaysRequired
                    && gate.filter { weighInDays.contains($0) }.count >= model.weighInsRequired
                let windowDays = daysBack(day, model.window)
                let intakeDays = windowDays.compactMap { logged[$0] }
                if canUpdate, !intakeDays.isEmpty,
                   let endTrend = trendByDay[windowDays.first!],
                   let startTrend = trendByDay[calendar.startOfDay(for: calendar.date(byAdding: .day, value: -1, to: windowDays.last!)!)] {
                    let meanIntake = intakeDays.reduce(0, +) / Double(intakeDays.count)
                    let raw = meanIntake - (endTrend - startTrend) * model.kcalPerKg / Double(model.window)
                    estimate += model.gain * (raw - estimate)
                    return ExpenditureDay(date: day, kcal: estimate, isHolding: false)
                }
                return ExpenditureDay(date: day, kcal: estimate, isHolding: true)
            }
        }
    }
}
