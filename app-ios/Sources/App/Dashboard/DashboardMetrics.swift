import Foundation

enum DashboardMetrics {
    static func workingSets(_ items: [BlockExercise]) -> [WorkoutSet] {
        items.flatMap(\.sets).filter { $0.isCompleted && $0.type != .warmUp }
    }

    /// Includes warm-ups, unlike working sets, to match the Workout Complete summary.
    static func volumeKg(_ items: [BlockExercise], catalog: (ExerciseID) -> Exercise?) -> Double {
        items.reduce(0) { total, item in
            guard let exercise = catalog(item.exerciseID) else { return total }
            return total + item.sets.filter(\.isCompleted).reduce(0) { $0 + WorkoutMetrics.volumeKg(of: $1, exercise: exercise) }
        }
    }


    enum WorkoutMetric: String, CaseIterable {
        case sets = "Sets", volume = "Volume"
    }

    static func workouts(_ sessions: [WorkoutSession], metric: WorkoutMetric, catalog: (ExerciseID) -> Exercise?) -> [DatedValue] {
        sessions.filter { $0.endedAt != nil }.map { session in
            let items = session.blocks.flatMap(\.exercises)
            let value = switch metric {
            case .sets: Double(workingSets(items).count)
            case .volume: volumeKg(items, catalog: catalog)
            }
            return DatedValue(date: session.startedAt, value: value)
        }
        .sorted { $0.date < $1.date }
    }

    static func topExercises(_ sessions: [WorkoutSession], since: Date, limit: Int = 5) -> [(exerciseID: ExerciseID, sets: Int)] {
        var counts: [ExerciseID: Int] = [:]
        for session in sessions where session.endedAt != nil && session.startedAt >= since {
            for item in session.blocks.flatMap(\.exercises) {
                counts[item.exerciseID, default: 0] += workingSets([item]).count
            }
        }
        return counts.filter { $0.value > 0 }
            .map { (exerciseID: $0.key, sets: $0.value) }
            .sorted { ($0.sets, $1.exerciseID) > ($1.sets, $0.exerciseID) }
            .prefix(limit)
            .map { $0 }
    }


    /// Volume splits like muscle sets: all of it to each primary muscle and half to each secondary.
    static func muscle(_ muscle: Muscle, sessions: [WorkoutSession], metric: MuscleMetric, catalog: (ExerciseID) -> Exercise?) -> [DatedValue] {
        sessions.filter { $0.endedAt != nil }.compactMap { session in
            let value = switch metric {
            case .sets: WorkoutMetrics.muscleSets(in: session.blocks, catalog: catalog, loggedOnly: true)[muscle] ?? 0
            case .volume: session.blocks.flatMap(\.exercises).reduce(0) { total, item in
                guard let exercise = catalog(item.exerciseID) else { return total }
                let share = exercise.primaryMuscles.contains(muscle) ? 1 : exercise.secondaryMuscles.contains(muscle) ? 0.5 : 0
                return total + share * volumeKg([item], catalog: catalog)
            }
            }
            return value > 0 ? DatedValue(date: session.startedAt, value: value) : nil
        }
        .sorted { $0.date < $1.date }
    }


    static func exercise(_ id: ExerciseID, sessions: [WorkoutSession], metric: ExerciseChartMetric, catalog: (ExerciseID) -> Exercise?) -> [DatedValue] {
        guard let exercise = catalog(id) else { return [] }
        return sessions.filter { $0.endedAt != nil }.compactMap { session in
            let items = session.blocks.flatMap(\.exercises).filter { $0.exerciseID == id }
            return value(metric, of: items, exercise: exercise).map { DatedValue(date: session.startedAt, value: $0) }
        }
        .sorted { $0.date < $1.date }
    }

    static func value(_ metric: ExerciseChartMetric, of items: [BlockExercise], exercise: Exercise) -> Double? {
        let working = workingSets(items)
        guard !working.isEmpty else { return nil }
        let stats = SessionRecords.stats(of: items, exercise: exercise)
        let logs = working.flatMap { [$0.log] + $0.subSets.map(\.log) }.compactMap { $0 }
        return switch metric {
        case .oneRM: stats.bestOneRepMaxKg
        case .threeRM: stats.bestOneRepMaxKg.map { repMaxKg(oneRepMaxKg: $0, reps: 3) }
        case .tenRM: stats.bestOneRepMaxKg.map { repMaxKg(oneRepMaxKg: $0, reps: 10) }
        case .heaviestWeight: logs.compactMap(\.weightKg).max()
        case .totalVolume: stats.volumeKg > 0 ? stats.volumeKg : nil
        case .bestSetVolume: working.map { WorkoutMetrics.volumeKg(of: $0, exercise: exercise) }.max().flatMap { $0 > 0 ? $0 : nil }
        case .totalReps: logs.compactMap(\.reps).reduce(0, +).nonZero.map(Double.init)
        case .bestSetReps: stats.bestReps.map(Double.init)
        case .totalSets: Double(working.count)
        }
    }

    static func repMaxKg(oneRepMaxKg: Double, reps: Int) -> Double {
        oneRepMaxKg / (WorkoutMetrics.estimatedOneRepMaxKg(weightKg: 1, reps: reps, rir: nil))
    }


    struct RecentRecord: Hashable {
        var exerciseID: ExerciseID
        var value: Double
        var date: Date
    }

    /// An exercise's first session counts as a record, matching Workout Complete's "New!".
    static func recentRecords(_ sessions: [WorkoutSession], kind: ExerciseRecord.Kind, limit: Int = 7, catalog: (ExerciseID) -> Exercise?) -> [RecentRecord] {
        var best: [ExerciseID: Double] = [:]
        var latest: [ExerciseID: RecentRecord] = [:]
        for session in sessions.filter({ $0.endedAt != nil }).sorted(by: { $0.startedAt < $1.startedAt }) {
            for (id, stats) in SessionRecords.stats(in: session.blocks, catalog: catalog) {
                guard let value = stats.value(kind), value > best[id] ?? 0 else { continue }
                best[id] = value
                latest[id] = RecentRecord(exerciseID: id, value: value, date: session.startedAt)
            }
        }
        return latest.values.sorted { ($0.date, $1.exerciseID) > ($1.date, $0.exerciseID) }.prefix(limit).map { $0 }
    }


    struct Ring: Equatable {
        var done: Int
        var target: Int?

        var left: Int? { target.map { max($0 - done, 0) } }
    }

    struct CycleProgress: Equatable {
        var muscles: Ring
        var sets: Ring
        var exercises: Ring
    }

    struct Counts: Equatable {
        var muscles: Int
        var sets: Int
        var exercises: Int
    }

    static func plan(_ program: Program, templates: [WorkoutTemplate], catalog: (ExerciseID) -> Exercise?) -> Counts {
        let blocks = program.days.compactMap { day in templates.first { $0.id == day.templateID } }
            .flatMap { $0.blocks.targets(forCycle: program.currentCycle) }
        let items = blocks.flatMap(\.exercises)
        return Counts(
            muscles: WorkoutMetrics.muscleSets(in: blocks, catalog: catalog, loggedOnly: false).count,
            sets: items.flatMap(\.sets).count { $0.type != .warmUp },
            exercises: items.count
        )
    }

    static func done(_ sessions: [WorkoutSession], catalog: (ExerciseID) -> Exercise?) -> Counts {
        let blocks = sessions.filter { $0.endedAt != nil }.flatMap(\.blocks)
        let items = blocks.flatMap(\.exercises)
        return Counts(
            muscles: WorkoutMetrics.muscleSets(in: blocks, catalog: catalog, loggedOnly: true).count,
            sets: workingSets(items).count,
            exercises: items.count { !workingSets([$0]).isEmpty }
        )
    }

    enum CycleScope: String, CaseIterable {
        case activeProgram = "Active Program", allWorkouts = "All Workouts"
    }

    /// All Workouts measures this week's sessions against the active program's cycle plan.
    static func cycleProgress(
        _ scope: CycleScope, program: Program?, templates: [WorkoutTemplate], sessions: [WorkoutSession],
        now: Date, calendar: Calendar, catalog: (ExerciseID) -> Exercise?
    ) -> CycleProgress {
        let counted = switch scope {
        case .activeProgram: sessions.filter { session in
            program.map { session.program?.programID == $0.id && session.program?.cycle == $0.currentCycle } ?? false
        }
        case .allWorkouts: sessions.filter { calendar.isDate($0.startedAt, equalTo: now, toGranularity: .weekOfYear) }
        }
        let done = done(counted, catalog: catalog)
        let plan = program.map { plan($0, templates: templates, catalog: catalog) }
        return CycleProgress(
            muscles: Ring(done: done.muscles, target: plan?.muscles),
            sets: Ring(done: done.sets, target: plan?.sets),
            exercises: Ring(done: done.exercises, target: plan?.exercises)
        )
    }


    static func habitDays(_ dates: [Date], count: Int = 30, now: Date, calendar: Calendar) -> [Bool] {
        let days = Set(dates.map { calendar.startOfDay(for: $0) })
        let today = calendar.startOfDay(for: now)
        return (0..<count).reversed().map { days.contains(calendar.date(byAdding: .day, value: -$0, to: today)!) }
    }

    static func daysThisWeek(_ dates: [Date], now: Date, calendar: Calendar) -> Int {
        Set(dates.filter { calendar.isDate($0, equalTo: now, toGranularity: .weekOfYear) }.map { calendar.startOfDay(for: $0) }).count
    }
}

private extension Int {
    var nonZero: Int? { self == 0 ? nil : self }
}
