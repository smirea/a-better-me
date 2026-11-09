import Foundation

extension NutritionEngine {
    /// A day `DayIntake` counts, with what the incomplete-day screen compares. A marked day (fasted, or totals entered
    /// by hand) is one the owner vouched for, so it is never screened out.
    struct CountedDay: Hashable {
        var date: Date
        var kcal: Double
        var proteinG: Double
        var entries: Int
        var isMarked = false
    }

    /// The maintenance the planner sets targets from: the stretches of the history dense enough to measure, each moved
    /// to today's weight and activity, pooled with a prior by inverse variance. See docs/decisions/nutrition.md,
    /// "Maintenance estimate". `server/src/agent/maintenance.ts` mirrors it.
    enum Maintenance {
        struct Model {
            var screenNearDays = 60
            var screenNearMinimum = 14
            var screenFarDays = 365
            var screenFarMinimum = 7
            var farBelow = 0.6
            var light = 0.75
            var fewEntries = 0.4
            var lowProtein = 0.5

            var window = 21
            var loggedShare = 0.6
            var weighInsPerWindow = 6
            var maxPeriod = 91
            /// Weight moves with water and glycogen for about two weeks after eating changes (a diet starts, a holiday ends).
            var settleDays = 14
            var activityDays = 28
            /// Hall's rule of thumb (Lancet 2011): maintenance moves about 22 kcal a day per kg of body weight.
            var kcalPerKgWeight = 22.0
            /// `Expenditure.Model.kcalPerStep`, the Step-Informed Updates constant.
            var kcalPerStep = Expenditure.Model.v3.kcalPerStep
            var stepShare = 0.5
            var minStepChange = 1500.0
            /// Resistance training is 3.5 METs (Compendium of Physical Activities, 02054): 2.5 above rest.
            var netWorkoutMets = 2.5
            var minWorkoutChange = 50.0
            var outlierMads = 3.0
            var outlierFloorKg = 1.0
            /// Water swings last days, so neighboring residuals are not independent.
            var slopeErrorInflation = 2.0
            /// How much unlogged days may differ from logged ones.
            var unloggedBias = 0.25
            var driftPerYear = 150.0
            var adjustmentError = 0.25
            /// MacroFactor puts a BMR formula's median error at 335 kcal (macrofactor.com/algorithm-accuracy).
            var priorSd = 400.0

            static let standard = Model()
        }

        enum IncompleteReason: Hashable {
            case farBelowTypical, fewEntries, lowProtein
        }

        struct IncompleteDay: Hashable {
            var date: Date
            var kcal: Double
            var typicalKcal: Double
            var reason: IncompleteReason
        }

        struct Screened: Hashable {
            var counted: [DatedValue]
            var incomplete: [IncompleteDay]
        }

        struct Adjustment: Hashable {
            enum Kind: Hashable {
                case weight, steps, workouts
            }

            var kind: Kind
            /// Kilograms, steps a day, or sessions a week, in the period and over the last four weeks.
            var before: Double
            var now: Double
            var kcal: Double
        }

        struct Period: Hashable {
            var start: Date
            var end: Date
            var days: Int
            var loggedDays: Int
            var weighIns: Int
            var intakeKcal: Double
            var weightChangeKg: Double
            var meanWeightKg: Double
            var measuredKcal: Double
            var adjustments: [Adjustment]
            var kcal: Double
            var sdKcal: Double
            var share: Double
        }

        struct Prior: Hashable {
            enum Source: Hashable {
                case initial, bmr
            }

            var kcal: Double
            var source: Source
            var share = 0.0
        }

        struct Estimate: Hashable {
            var kcal: Double
            var sdKcal: Double
            var weightKg: Double
            var periods: [Period]
            var prior: Prior?
            var incomplete: [IncompleteDay]
        }

        /// A day far below the owner's typical intake, or a light day with few entries or little protein, is left out as
        /// if marked incomplete. Typical is the median of the other days within 60 days, or within a year when the 60 days
        /// hold too few, so a sparse logger's partial days are not compared with each other.
        static func screen(_ days: [CountedDay], calendar: Calendar, model: Model = .standard) -> Screened {
            let ordinal = { (date: Date) in calendar.ordinality(of: .day, in: .era, for: date)! }
            let reference = days.filter { !$0.isMarked && $0.kcal > 0 }.map { (day: ordinal($0.date), value: $0) }.sorted { $0.day < $1.day }
            var result = Screened(counted: [], incomplete: [])
            for day in days {
                let index = ordinal(day.date)
                if !day.isMarked, day.kcal > 0,
                   let typical = typical(of: index, reference, model: model),
                   let reason = reason(day, typical, model: model) {
                    result.incomplete.append(IncompleteDay(date: day.date, kcal: day.kcal, typicalKcal: typical.kcal, reason: reason))
                } else {
                    result.counted.append(DatedValue(date: day.date, value: day.kcal))
                }
            }
            return result
        }

        private struct Typical {
            var kcal: Double
            var proteinG: Double
            var entries: Double
        }

        private static func typical(of index: Int, _ reference: [(day: Int, value: CountedDay)], model: Model) -> Typical? {
            // `reference` is sorted by day, so each span is a slice found by binary search.
            func within(_ span: Int) -> [CountedDay] {
                let lower = firstIndex(in: reference) { $0.day >= index - span }
                let upper = firstIndex(in: reference) { $0.day > index + span }
                return reference[lower..<upper].filter { $0.day != index }.map(\.value)
            }
            let near = within(model.screenNearDays)
            let others = near.count >= model.screenNearMinimum ? near : within(model.screenFarDays)
            guard others.count >= model.screenFarMinimum else { return nil }
            return Typical(kcal: median(others.map(\.kcal)), proteinG: median(others.map(\.proteinG)), entries: median(others.map { Double($0.entries) }))
        }

        private static func reason(_ day: CountedDay, _ typical: Typical, model: Model) -> IncompleteReason? {
            if day.kcal < model.farBelow * typical.kcal { return .farBelowTypical }
            if day.kcal >= model.light * typical.kcal { return nil }
            if Double(day.entries) <= model.fewEntries * typical.entries { return .fewEntries }
            if day.proteinG < model.lowProtein * typical.proteinG { return .lowProtein }
            return nil
        }

        /// Today's maintenance at `weightKg`, from data through yesterday. `workouts` holds each finished session at its
        /// start with its active minutes. Nil without a measurable period or a prior.
        static func estimate(
            days: [CountedDay], weighIns: [DatedValue], weightKg: Double, steps: [DatedValue], workouts: [DatedValue], prior: Prior?,
            from calculationStart: Date? = nil, today: Date, calendar: Calendar, model: Model = .standard
        ) -> Estimate? {
            let ordinal = { (date: Date) in calendar.ordinality(of: .day, in: .era, for: date)! }
            let end = ordinal(today) - 1
            let screened = screen(days.filter { ordinal($0.date) <= end }, calendar: calendar, model: model)
            let counted = Dictionary(screened.counted.map { (ordinal($0.date), $0.value) }, uniquingKeysWith: { $1 })
            let weights = Dictionary(grouping: weighIns.filter { ordinal($0.date) <= end }, by: { ordinal($0.date) })
                .mapValues { $0.map(\.value).reduce(0, +) / Double($0.count) }
            let stepsByDay = Dictionary(steps.map { (ordinal($0.date), $0.value) }, uniquingKeysWith: { $1 })
            let sessions = workouts.map { (day: ordinal($0.date), minutes: $0.value) }
            let firstWorkout = sessions.map(\.day).min()
            let todayDate = calendar.startOfDay(for: today)
            let date = { (day: Int) in calendar.date(byAdding: .day, value: day - end - 1, to: todayDate)! }

            var periods: [Period] = []
            let earliest = (Array(counted.keys) + Array(weights.keys)).min()
            if let earliest, case let first = max(earliest, calculationStart.map(ordinal) ?? earliest), first <= end {
                let now = activity(over: end - model.activityDays + 1...end, steps: stepsByDay, sessions: sessions, firstWorkout: firstWorkout, model: model)
                periods = measuredRuns(first...end, counted: counted, weights: weights, model: model).compactMap { run in
                    guard let measured = measure(run, counted: counted, weights: weights, model: model) else { return nil }
                    let past = activity(over: run, steps: stepsByDay, sessions: sessions, firstWorkout: firstWorkout, model: model)
                    return adjust(
                        measured, start: date(run.lowerBound), end: date(run.upperBound), past: past, now: now, weightKg: weightKg,
                        yearsAgo: Double(end + 1 - run.upperBound) / 365, model: model
                    )
                }
            }

            let sources = periods.map { ($0.kcal, $0.sdKcal) } + (prior.map { [($0.kcal, model.priorSd)] } ?? [])
            guard !sources.isEmpty else { return nil }
            let inverse = sources.map { 1 / ($0.1 * $0.1) }
            let total = inverse.reduce(0, +)
            for index in periods.indices { periods[index].share = inverse[index] / total }
            return Estimate(
                kcal: zip(sources, inverse).map { $0.0 * $1 }.reduce(0, +) / total,
                sdKcal: 1 / total.squareRoot(),
                weightKg: weightKg,
                periods: periods,
                prior: prior.map { prior in
                    var prior = prior
                    prior.share = inverse.last! / total
                    return prior
                },
                incomplete: screened.incomplete
            )
        }

        /// Runs of days covered by a 21-day window with 60% of days counted and six weigh-ins, from their first to their
        /// last counted day, less each run's settling days, split past 91 days.
        private static func measuredRuns(_ span: ClosedRange<Int>, counted: [Int: Double], weights: [Int: Double], model: Model) -> [ClosedRange<Int>] {
            guard span.count >= model.window else { return [] }
            var covered = [Bool](repeating: false, count: span.count)
            var logged = [0], weighed = [0]
            for day in span {
                logged.append(logged.last! + (counted[day] == nil ? 0 : 1))
                weighed.append(weighed.last! + (weights[day] == nil ? 0 : 1))
            }
            for last in (model.window - 1)..<span.count {
                let first = last - model.window + 1
                if Double(logged[last + 1] - logged[first]) >= model.loggedShare * Double(model.window),
                   weighed[last + 1] - weighed[first] >= model.weighInsPerWindow {
                    for index in first...last { covered[index] = true }
                }
            }
            var runs: [ClosedRange<Int>] = []
            var index = 0
            while index < covered.count {
                guard covered[index] else { index += 1; continue }
                var last = index
                while last + 1 < covered.count, covered[last + 1] { last += 1 }
                runs.append(span.lowerBound + index...span.lowerBound + last)
                index = last + 1
            }
            return runs.flatMap { run -> [ClosedRange<Int>] in
                guard let first = run.first(where: { counted[$0] != nil }), let last = run.last(where: { counted[$0] != nil }) else { return [] }
                let start = first + model.settleDays
                guard last - start + 1 >= model.window else { return [] }
                let length = last - start + 1
                let chunks = (length + model.maxPeriod - 1) / model.maxPeriod
                let size = (length + chunks - 1) / chunks
                return stride(from: start, through: last, by: size).map { $0...min($0 + size - 1, last) }
            }
        }

        private struct Measured {
            var days: Int
            var loggedDays: Int
            var weighIns: Int
            var intakeKcal: Double
            var weightChangeKg: Double
            var meanWeightKg: Double
            var measuredKcal: Double
            var baseSd: Double
        }

        private static func measure(_ run: ClosedRange<Int>, counted: [Int: Double], weights: [Int: Double], model: Model) -> Measured? {
            let intake = run.compactMap { counted[$0] }
            let points = run.compactMap { day in weights[day].map { (x: Double(day - run.lowerBound), y: $0) } }
            guard !intake.isEmpty, let fit = robustLine(points, model: model) else { return nil }
            let mean = intake.reduce(0, +) / Double(intake.count)
            let coverage = Double(intake.count) / Double(run.count)
            let intakeSd = intake.count > 1 ? (intake.map { ($0 - mean) * ($0 - mean) }.reduce(0, +) / Double(intake.count - 1)).squareRoot() : 0
            let kcalPerKg = NutritionEngine.kcalPerLb / NutritionEngine.kgPerLb
            let slopeSd = fit.slopeSe * kcalPerKg * model.slopeErrorInflation
            return Measured(
                days: run.count, loggedDays: intake.count, weighIns: fit.used, intakeKcal: mean,
                weightChangeKg: fit.slope * Double(run.count),
                meanWeightKg: fit.intercept + fit.slope * Double(run.count - 1) / 2,
                measuredKcal: mean - fit.slope * kcalPerKg,
                baseSd: hypot(slopeSd, intakeSd / Double(intake.count).squareRoot(), (1 - coverage) * model.unloggedBias * mean)
            )
        }

        private struct Line {
            var slope: Double
            var intercept: Double
            var slopeSe: Double
            var used: Int

            func at(_ x: Double) -> Double { intercept + slope * x }
        }

        /// A least-squares line, refitted once without the weigh-ins more than three MADs (at least 1 kg) off it.
        private static func robustLine(_ points: [(x: Double, y: Double)], model: Model) -> Line? {
            guard let first = line(points) else { return nil }
            let residuals = points.map { abs($0.y - first.at($0.x)) }
            let cutoff = max(model.outlierFloorKg, model.outlierMads * 1.4826 * median(residuals))
            return line(zip(points, residuals).filter { $0.1 <= cutoff }.map(\.0))
        }

        private static func line(_ points: [(x: Double, y: Double)]) -> Line? {
            guard points.count >= 3 else { return nil }
            let n = Double(points.count)
            let mx = points.map(\.x).reduce(0, +) / n
            let my = points.map(\.y).reduce(0, +) / n
            let sxx = points.map { ($0.x - mx) * ($0.x - mx) }.reduce(0, +)
            guard sxx > 0 else { return nil }
            let slope = points.map { ($0.x - mx) * ($0.y - my) }.reduce(0, +) / sxx
            let intercept = my - slope * mx
            let residualSd = (points.map { pow($0.y - (intercept + slope * $0.x), 2) }.reduce(0, +) / (n - 2)).squareRoot()
            return Line(slope: slope, intercept: intercept, slopeSe: residualSd / sxx.squareRoot(), used: points.count)
        }

        private struct Activity {
            var steps: Double?
            var workoutsPerDay: Double?
            var minutesPerWorkout: Double?
        }

        /// Mean steps over the days with steps once half the days have them; workouts only once the history holds any.
        private static func activity(
            over days: ClosedRange<Int>, steps: [Int: Double], sessions: [(day: Int, minutes: Double)], firstWorkout: Int?, model: Model
        ) -> Activity {
            let counts = days.compactMap { steps[$0] }
            let done = sessions.filter { days.contains($0.day) }
            return Activity(
                steps: Double(counts.count) >= model.stepShare * Double(days.count) ? counts.reduce(0, +) / Double(counts.count) : nil,
                workoutsPerDay: firstWorkout.map { days.lowerBound >= $0 } == true ? Double(done.count) / Double(days.count) : nil,
                minutesPerWorkout: done.isEmpty ? nil : done.map(\.minutes).reduce(0, +) / Double(done.count)
            )
        }

        private static func adjust(
            _ period: Measured, start: Date, end: Date, past: Activity, now: Activity, weightKg: Double, yearsAgo: Double, model: Model
        ) -> Period {
            var adjustments = [Adjustment(kind: .weight, before: period.meanWeightKg, now: weightKg, kcal: (weightKg - period.meanWeightKg) * model.kcalPerKgWeight)]
            if let before = past.steps, let after = now.steps, abs(after - before) >= model.minStepChange {
                adjustments.append(Adjustment(kind: .steps, before: before, now: after, kcal: model.kcalPerStep * (after - before)))
            }
            if let before = past.workoutsPerDay, let after = now.workoutsPerDay {
                let minutes = now.minutesPerWorkout ?? past.minutesPerWorkout ?? 0
                let kcal = (after - before) * minutes / 60 * model.netWorkoutMets * weightKg
                if abs(kcal) >= model.minWorkoutChange {
                    adjustments.append(Adjustment(kind: .workouts, before: before * 7, now: after * 7, kcal: kcal))
                }
            }
            let activity = adjustments.filter { $0.kind != .weight }.map { abs($0.kcal) }.reduce(0, +)
            return Period(
                start: start, end: end, days: period.days, loggedDays: period.loggedDays, weighIns: period.weighIns,
                intakeKcal: period.intakeKcal, weightChangeKg: period.weightChangeKg, meanWeightKg: period.meanWeightKg,
                measuredKcal: period.measuredKcal, adjustments: adjustments,
                kcal: period.measuredKcal + adjustments.map(\.kcal).reduce(0, +),
                sdKcal: hypot(period.baseSd, model.driftPerYear * yearsAgo, model.adjustmentError * activity),
                share: 0
            )
        }

        /// The first index where `isAfter` holds, for a predicate that is false and then true along `items`.
        private static func firstIndex<T>(in items: [T], where isAfter: (T) -> Bool) -> Int {
            var low = 0, high = items.count
            while low < high {
                let middle = (low + high) / 2
                if isAfter(items[middle]) { high = middle } else { low = middle + 1 }
            }
            return low
        }

        private static func hypot(_ values: Double...) -> Double {
            values.map { $0 * $0 }.reduce(0, +).squareRoot()
        }

        private static func median(_ values: [Double]) -> Double {
            let sorted = values.sorted()
            let middle = sorted.count / 2
            return sorted.count % 2 == 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
        }
    }
}
