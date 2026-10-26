// The calibration harness: runs the engine over the owner's exported history and prints the error against
// MacroFactor's own columns, for the baseline reading of the help and for the shipped model. Built by `calibrate-engine`.
import Foundation

struct Point: Decodable {
    var day: Int
    var value: Double
}

struct Export: Decodable {
    var scaleLb: [Point]
    var trendLb: [Point]
    var expenditure: [Point]
    var intakeKcal: [Point]
    var incomplete: [String]
    var fasting: [String]
}

let calendar: Calendar = {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "UTC")!
    return calendar
}()
let excelEpoch = calendar.date(from: DateComponents(year: 1899, month: 12, day: 30))!
func date(_ serial: Int) -> Date { calendar.date(byAdding: .day, value: serial, to: excelEpoch)! }
func series(_ points: [Point], scale: Double = 1) -> [DatedValue] { points.map { DatedValue(date: date($0.day), value: $0.value * scale) } }

/// The Dashboard's trend before this engine: after a gap of d days a weigh-in closed 1 - 0.9^d of the gap and a day
/// without a weigh-in kept the trend.
func legacyTrend(_ weighIns: [DatedValue], through end: Date) -> [DatedValue] {
    let days = DailyCombine.mean.combine(weighIns, calendar: calendar)
    guard let first = days.first else { return [] }
    var trend = first.value, trendDay = first.date, pending = days.dropFirst()[...]
    return NutritionEngine.eachDay(from: first.date, through: end, calendar: calendar).map { day in
        if let weighIn = pending.first, calendar.isDate(weighIn.date, inSameDayAs: day) {
            let gap = Double(NutritionEngine.days(from: trendDay, to: day, calendar: calendar))
            trend += (1 - pow(0.9, gap)) * (weighIn.value - trend)
            trendDay = day
            pending.removeFirst()
        }
        return DatedValue(date: day, value: trend)
    }
}

struct Error: CustomStringConvertible {
    var mean: Double, max: Double, count: Int
    init(_ pairs: [(Double, Double)]) {
        let errors = pairs.map { abs($0.0 - $0.1) }
        count = errors.count
        mean = errors.reduce(0, +) / Double(Swift.max(count, 1))
        max = errors.max() ?? 0
    }
    var description: String { String(format: "mean %.4f  max %.4f  (%d days)", mean, max, count) }
}

func compare(_ model: [DatedValue], _ reference: [DatedValue]) -> Error {
    let byDay = Dictionary(model.map { ($0.date, $0.value) }, uniquingKeysWith: { $1 })
    return Error(reference.compactMap { point in byDay[point.date].map { ($0, point.value) } })
}

@main
struct Calibrate {
    static func main() throws {
        let export = try JSONDecoder().decode(Export.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        let kg = NutritionEngine.kgPerLb
        let scale = series(export.scaleLb, scale: kg)
        let trendRef = series(export.trendLb, scale: kg)
        let expenditureRef = series(export.expenditure)
        let end = trendRef.last!.date

        print("Trend weight, kg, against MacroFactor's Weight Trend column")
        print("  baseline (gap rule, hold):               ", compare(legacyTrend(scale, through: end), trendRef))
        let trend = NutritionEngine.TrendWeight.daily(weighIns: scale, through: end, calendar: calendar)
        print("  final (interpolate, week seed, EMA 0.1):", compare(trend, trendRef))
        let afterSeed = trendRef.filter { $0.date >= calendar.date(byAdding: .day, value: 60, to: trendRef[0].date)! }
        print("  final, after the first 60 days:          ", compare(trend, afterSeed))

        let intake = export.intakeKcal.map { NutritionEngine.IntakeDay(date: date($0.day), kcal: $0.value) }
        let start = expenditureRef[0].date
        let initial = expenditureRef[0].value
        print("\nExpenditure, kcal/day, against MacroFactor's Expenditure column (seeded with its first value)")
        func run(_ model: NutritionEngine.Expenditure.Model, _ trend: [DatedValue]) -> [DatedValue] {
            NutritionEngine.Expenditure.daily(intake: intake, trend: trend, weighIns: scale, initial: initial, from: start, through: end, calendar: calendar, model: model)
                .map { DatedValue(date: $0.date, value: $0.kcal) }
        }
        print("  baseline (21-day box, 3500 kcal/lb, unsmoothed):", compare(run(.baseline, trendRef), expenditureRef))
        print("  final on MacroFactor's trend:                    ", compare(run(.v3, trendRef), expenditureRef))
        print("  final on the engine's own trend:                 ", compare(run(.v3, trend), expenditureRef))
        let days = NutritionEngine.Expenditure.daily(intake: intake, trend: trend, weighIns: scale, initial: initial, from: start, through: end, calendar: calendar)
        let holdingRef = zip(expenditureRef, expenditureRef.dropFirst()).map { $0.value == $1.value }
        let holdingModel = days.dropFirst().map(\.isHolding)
        let agree = zip(holdingRef, holdingModel).filter { $0 == $1 }.count
        print("  holding days agree with an unchanged export value on \(agree) of \(holdingRef.count) days")
    }
}
