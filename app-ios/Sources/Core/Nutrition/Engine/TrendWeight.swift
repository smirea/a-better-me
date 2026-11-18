import Foundation

extension NutritionEngine {
    /// MacroFactor's Weight Trend V1: an exponential moving average with a 0.1 daily factor over the scale weight,
    /// where a day without a weigh-in takes the value interpolated between the weigh-ins around it and a day after
    /// the last weigh-in takes the last weigh-in. It only looks back, so a later weigh-in never rewrites past days
    /// before it, except that it fills the gap days before it and that the first week seeds the start. Calibrated on
    /// the owner's export: mean error 1 g, max 9 g.
    enum TrendWeight {
        static let smoothing = 0.1
        static let seedDays = 7

        /// `weighIns` are in kg at any time of day; several on one day are averaged first.
        static func daily(weighIns: [DatedValue], through end: Date, calendar: Calendar) -> [DatedValue] {
            let scale = dailyScale(weighIns, through: end, calendar: calendar)
            guard !scale.isEmpty else { return [] }
            var trend = seed(scale.prefix(seedDays).map(\.value))
            return scale.map { day in
                trend += smoothing * (day.value - trend)
                return DatedValue(date: day.date, value: trend)
            }
        }

        /// The trend starts at the intercept of a least-squares line through the first week's daily scale weight, not
        /// at the first weigh-in: that is what reproduces MacroFactor's first values (max error 0.29 lb from the first
        /// weigh-in, 0.02 lb from this), so the first week's trend settles as its weigh-ins arrive.
        static func seed(_ values: [Double]) -> Double {
            guard values.count > 1 else { return values[0] }
            let n = Double(values.count)
            let meanX = (n - 1) / 2
            let meanY = values.reduce(0, +) / n
            var covariance = 0.0, variance = 0.0
            for (index, value) in values.enumerated() {
                let dx = Double(index) - meanX
                covariance += dx * (value - meanY)
                variance += dx * dx
            }
            return meanY - covariance / variance * meanX
        }

        /// The scale weight MacroFactor smooths: one value per day from the first weigh-in through `end`.
        static func dailyScale(_ weighIns: [DatedValue], through end: Date, calendar: Calendar) -> [DatedValue] {
            let days = DailyCombine.mean.combine(weighIns, calendar: calendar)
            guard let first = days.first else { return [] }
            var next = days[...]
            var previous = first
            var result: [DatedValue] = []
            for day in eachDay(from: first.date, through: max(end, days.last!.date), calendar: calendar) {
                if let weighIn = next.first, calendar.isDate(weighIn.date, inSameDayAs: day) {
                    previous = weighIn
                    next.removeFirst()
                    result.append(DatedValue(date: day, value: weighIn.value))
                } else if let upcoming = next.first {
                    let span = Double(NutritionEngine.days(from: previous.date, to: upcoming.date, calendar: calendar))
                    let elapsed = Double(NutritionEngine.days(from: previous.date, to: day, calendar: calendar))
                    result.append(DatedValue(date: day, value: previous.value + (upcoming.value - previous.value) * elapsed / span))
                } else {
                    result.append(DatedValue(date: day, value: previous.value))
                }
            }
            return result
        }
    }
}
