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

/// The Fasting and Partial Logging sheets date their rows as `M/D/YYYY` text.
func flaggedDay(_ text: String) -> Date {
    let parts = text.split(separator: "/").map { Int($0)! }
    return calendar.date(from: DateComponents(year: parts[2], month: parts[0], day: parts[1]))!
}

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

/// MacroFactor's accuracy measure (macrofactor.com/algorithm-accuracy): over each 30-day window, the energy balance an
/// expenditure series and the logged intake imply against the trend's actual change. Unlogged days are counted at the
/// logged days' mean balance, and a window needs 24 logged days.
struct Predictive: CustomStringConvertible {
    var medianKcal: Double, r: Double, over10Percent: Double, fittedKcalPerLb: Double, count: Int

    init(expenditure: [DatedValue], intake: [Date: Double], trend: [DatedValue], kcalPerLb: Double, days span: Int = 30) {
        let kcalPerKg = kcalPerLb / NutritionEngine.kgPerLb
        let estimate = Dictionary(expenditure.map { ($0.date, $0.value) }, uniquingKeysWith: { $1 })
        let trendOn = Dictionary(trend.map { ($0.date, $0.value) }, uniquingKeysWith: { $1 })
        var balances: [Double] = [], changes: [Double] = [], levels: [Double] = []
        for start in expenditure.map(\.date) {
            let window = (0..<span).map { calendar.date(byAdding: .day, value: $0, to: start)! }
            let logged = window.compactMap { day in intake[day].flatMap { kcal in estimate[day].map { kcal - $0 } } }
            guard logged.count >= 24, let first = trendOn[start],
                  let last = trendOn[calendar.date(byAdding: .day, value: span, to: start)!], let level = estimate[start] else { continue }
            balances.append(logged.reduce(0, +) / Double(logged.count))
            changes.append((last - first) / Double(span))
            levels.append(level)
        }
        count = balances.count
        let errors = zip(balances, changes).map { abs($0 - $1 * kcalPerKg) }
        medianKcal = errors.sorted()[errors.count / 2]
        over10Percent = Double(zip(errors, levels).filter { $0 >= 0.1 * $1 }.count) / Double(count)
        let mb = balances.reduce(0, +) / Double(count), mc = changes.reduce(0, +) / Double(count)
        let cov = zip(balances, changes).map { ($0 - mb) * ($1 - mc) }.reduce(0, +)
        r = cov / (balances.map { pow($0 - mb, 2) }.reduce(0, +) * changes.map { pow($0 - mc, 2) }.reduce(0, +)).squareRoot()
        fittedKcalPerLb = zip(balances, changes).map { $0 * $1 }.reduce(0, +) / changes.map { $0 * $0 }.reduce(0, +) * NutritionEngine.kgPerLb
    }

    var description: String {
        String(format: "median %.0f kcal/day  r %.3f  >=10%% off %.0f%%  fitted %.0f kcal/lb  (%d windows)", medianKcal, r, over10Percent * 100, fittedKcalPerLb, count)
    }
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

        let incomplete = Set(export.incomplete.map(flaggedDay))
        let fasting = Set(export.fasting.map(flaggedDay))
        var intake = export.intakeKcal.map { NutritionEngine.IntakeDay(date: date($0.day), kcal: $0.value, isIncomplete: incomplete.contains(date($0.day))) }
        let loggedDays = Set(intake.map(\.date))
        intake += fasting.subtracting(loggedDays).map { NutritionEngine.IntakeDay(date: $0, kcal: 0) }
        print("  \(incomplete.count) incomplete days, \(fasting.count) fasting days")
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

        let counted = Dictionary(intake.filter { !$0.isIncomplete }.map { ($0.date, $0.kcal) }, uniquingKeysWith: { $1 })
        let engine = run(.v3, trend)
        // A TDEE formula recomputed daily: the seed scaled by the MacroFactor Equation as the trend moves.
        let bmr = { (kg: Double) in NutritionEngine.BMR.macroFactor(weightKg: kg, heightCm: 180, ageYears: 35, sex: .male) }
        let trendByDay = Dictionary(trend.map { ($0.date, $0.value) }, uniquingKeysWith: { $1 })
        let formula = expenditureRef.compactMap { point in trendByDay[point.date].map { DatedValue(date: point.date, value: initial * bmr($0) / bmr(trendByDay[start]!)) } }
        for density in [3000.0, 3500.0] {
            print("\nPredictive validity at \(Int(density)) kcal/lb, 30-day windows against the engine's trend")
            print("  MacroFactor's expenditure:", Predictive(expenditure: expenditureRef, intake: counted, trend: trend, kcalPerLb: density))
            print("  the engine:               ", Predictive(expenditure: engine, intake: counted, trend: trend, kcalPerLb: density))
            print("  formula, scaled daily:    ", Predictive(expenditure: formula, intake: counted, trend: trend, kcalPerLb: density))
        }

        // A new user: weigh-ins and intake begin on a day of the owner's history and the initial estimate is off by
        // `offset`; the error is against MacroFactor's full-history column over the first 60 days, and days 30 to 59.
        let lastIntake = intake.map(\.date).max()!
        let starts = stride(from: 0, to: 400, by: 7).map { calendar.date(byAdding: .day, value: $0, to: start)! }
            .filter { calendar.date(byAdding: .day, value: 60, to: $0)! <= lastIntake }
            .filter { day in counted.keys.filter { $0 >= day && $0 < calendar.date(byAdding: .day, value: 60, to: day)! }.count >= 40 }
        let reference = Dictionary(expenditureRef.map { ($0.date, $0.value) }, uniquingKeysWith: { $1 })
        func startup(_ model: NutritionEngine.Expenditure.Model) -> (Double, Double) {
            var all: [Double] = [], late: [Double] = []
            for day in starts {
                let weighIns = scale.filter { $0.date >= day }
                let fresh = NutritionEngine.TrendWeight.daily(weighIns: weighIns, through: end, calendar: calendar)
                for offset in [-500.0, -250, 250, 500] {
                    let result = NutritionEngine.Expenditure.daily(
                        intake: intake.filter { $0.date >= day }, trend: fresh, weighIns: weighIns, initial: reference[day]! + offset,
                        from: day, through: calendar.date(byAdding: .day, value: 59, to: day)!, calendar: calendar, model: model)
                    for (index, point) in result.enumerated() {
                        let error = abs(point.kcal - reference[point.date]!)
                        all.append(error)
                        if index >= 30 { late.append(error) }
                    }
                }
            }
            return (all.reduce(0, +) / Double(all.count), late.reduce(0, +) / Double(late.count))
        }
        print("\nA new user, \(starts.count) start days × 4 initial errors, mean error against MacroFactor's column")
        func show(_ label: String, _ model: NutritionEngine.Expenditure.Model) {
            let (all, late) = startup(model)
            print(String(format: "  %@ days 0-59 %.0f  days 30-59 %.0f", label, all, late))
        }
        show("no startup (needs 28 days of trend):", NutritionEngine.Expenditure.Model(minWindow: 28, startupGain: 0.015))
        show("shipped:                             ", .v3)
        if CommandLine.arguments.contains("--grid") {
            for minWindow in [3, 5, 7, 14] {
                for startupGain in [0.05, 0.1, 0.2, 0.3, 0.5] {
                    show("min \(minWindow) gain \(startupGain):", NutritionEngine.Expenditure.Model(minWindow: minWindow, startupGain: startupGain))
                }
            }
        }
    }
}
