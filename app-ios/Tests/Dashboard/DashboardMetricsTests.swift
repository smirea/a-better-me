import Foundation
import Testing
@testable import App

private let press = Exercise(id: "press", name: "Press", type: .compound, primaryMuscles: [.chest], secondaryMuscles: [.triceps, .frontDelts], metrics: [.weight, .reps])
private let curl = Exercise(id: "curl", name: "Curl", type: .isolation, primaryMuscles: [.biceps], metrics: [.weightPerSide, .reps])
private func catalog(_ id: ExerciseID) -> Exercise? { ["press": press, "curl": curl][id] }

private func logged(_ kg: Double, _ reps: Int, rir: Int? = nil, type: SetType = .standard, drops: [(Double, Int)] = []) -> WorkoutSet {
    var set = WorkoutSet(type: type)
    set.log = SetLog(weightKg: kg, reps: reps, rir: rir, completedAt: .now)
    set.subSets = drops.map { SubSet(log: SetLog(weightKg: $0.0, reps: $0.1, completedAt: .now)) }
    return set
}

private func session(_ date: String, _ items: [BlockExercise], finished: Bool = true, program: ProgramPosition? = nil) -> WorkoutSession {
    var session = WorkoutSession(name: "S", blocks: items.map { WorkoutBlock(exercises: [$0]) }, startedAt: day(date, 18))
    session.endedAt = finished ? session.startedAt.addingTimeInterval(3600) : nil
    session.program = program
    return session
}

struct DashboardMetricsTests {
    @Test func workoutSetsSkipWarmUpsAndCountADropSetOnce() {
        let sessions = [
            session("2026-10-02", [BlockExercise(exerciseID: "press", sets: [logged(40, 8, type: .warmUp), logged(80, 8), logged(80, 6, type: .drop, drops: [(60, 5)])])]),
            session("2026-10-01", [BlockExercise(exerciseID: "curl", sets: [logged(10, 10), WorkoutSet()])]),
            session("2026-10-03", [BlockExercise(exerciseID: "press", sets: [logged(80, 8)])], finished: false),
        ]
        let sets = DashboardMetrics.workouts(sessions, metric: .sets, catalog: catalog)
        #expect(sets.map(\.value) == [1, 2])
        let volume = DashboardMetrics.workouts(sessions, metric: .volume, catalog: catalog)
        #expect(volume.map(\.value) == [200, 1740])
    }

    @Test func muscleSeriesSplitsSetsAndVolumeByPrimaryAndSecondary() {
        let sessions = [session("2026-10-01", [BlockExercise(exerciseID: "press", sets: [logged(100, 5), logged(100, 5)])])]
        #expect(DashboardMetrics.muscle(.chest, sessions: sessions, metric: .sets, catalog: catalog).map(\.value) == [2])
        #expect(DashboardMetrics.muscle(.triceps, sessions: sessions, metric: .sets, catalog: catalog).map(\.value) == [1])
        #expect(DashboardMetrics.muscle(.triceps, sessions: sessions, metric: .volume, catalog: catalog).map(\.value) == [500])
        #expect(DashboardMetrics.muscle(.biceps, sessions: sessions, metric: .sets, catalog: catalog).isEmpty)
    }

    @Test func exerciseMetricsPerSession() {
        let items = [BlockExercise(exerciseID: "press", sets: [logged(50, 10, type: .warmUp), logged(100, 5, rir: 1), logged(90, 8, rir: 0)])]
        let byMetric = DashboardMetrics.values(of: items, exercise: press)
        let values = ExerciseChartMetric.allCases.map { byMetric[$0].map { ($0 * 10).rounded() / 10 } }
        #expect(values == [120, 109.1, 90, 100, 1720, 720, 13, 8, 2])
    }

    @Test func exerciseSeriesHasEveryMetricOldestFirstAndSkipsUnfinishedOrUntrained() {
        let sessions = [
            session("2026-10-05", [BlockExercise(exerciseID: "press", sets: [logged(100, 5), logged(90, 8)])]),
            session("2026-10-01", [BlockExercise(exerciseID: "press", sets: [logged(80, 10)])]),
            session("2026-10-03", [BlockExercise(exerciseID: "curl", sets: [logged(10, 10)])]),
            session("2026-10-07", [BlockExercise(exerciseID: "press", sets: [logged(120, 1)])], finished: false),
        ]
        let series = DashboardMetrics.exercise("press", sessions: sessions, catalog: catalog)
        #expect(Set(series.keys) == Set(ExerciseChartMetric.allCases))
        #expect(series[.totalSets] == [DatedValue(date: day("2026-10-01", 18), value: 1), DatedValue(date: day("2026-10-05", 18), value: 2)])
        #expect(series[.totalVolume]?.map(\.value) == [800, 1220])
        #expect(series[.heaviestWeight]?.map(\.value) == [80, 100])
        #expect(DashboardMetrics.exercise("unknown", sessions: sessions, catalog: catalog).isEmpty)
    }

    @Test func lastDaysSumsEachOfTheLastSevenDaysEndingToday() {
        let data = DashboardData(sessions: [], weighIns: [], steps: [], unit: .kg, catalog: catalog, now: day("2026-10-07", 12), calendar: utc)
        let points = [
            DatedValue(date: day("2026-09-30"), value: 99),
            DatedValue(date: day("2026-10-01", 0), value: 1),
            DatedValue(date: day("2026-10-04", 7), value: 2),
            DatedValue(date: day("2026-10-04", 20), value: 3),
            DatedValue(date: day("2026-10-07", 23), value: 4),
        ]
        #expect(data.lastDays(points) == [1, 0, 0, 5, 0, 0, 4])
    }

    @Test func longRangesDrawCoarserBuckets() {
        let now = day("2026-10-07")
        let year = ChartRange.oneYear.interval(endingAt: now, earliest: nil, calendar: utc)
        let sixMonths = ChartRange.sixMonths.interval(endingAt: now, earliest: nil, calendar: utc)
        let threeYears = ChartRange.all.interval(endingAt: now, earliest: day("2023-10-01"), calendar: utc)
        #expect(Averaging.daily.drawn(over: sixMonths) == .daily)
        #expect(Averaging.daily.drawn(over: year) == .weekly)
        #expect(Averaging.monthly.drawn(over: year) == .monthly)
        #expect(Averaging.weekly.drawn(over: threeYears) == .monthly)
    }

    @Test func plotListsEveryEntryNewestFirstByMonth() {
        let tab = MetricTab(
            title: "Sets", points: [
                DatedValue(date: day("2026-08-20", 0), value: 1),
                DatedValue(date: day("2026-09-10", 0), value: 2),
                DatedValue(date: day("2026-09-28", 0), value: 3),
                DatedValue(date: day("2026-10-02", 0), value: 4),
            ],
            unit: "sets", averageTitle: "Average Sets", summary: .total, style: .bar, color: DashboardColor.muscle
        )
        let plot = MetricPlot(tab: tab, footer: .months, range: .oneMonth, averaging: .weekly, now: day("2026-10-07"), calendar: utc, unit: .kg)
        #expect(plot.interval == DateInterval(start: day("2026-09-08", 0), end: day("2026-10-08", 0)))
        #expect(plot.months.map(\.id) == [day("2026-10-01", 0), day("2026-09-01", 0), day("2026-08-01", 0)])
        #expect(plot.months.map { $0.rows.map(\.text) } == [["4 sets"], ["3 sets", "2 sets"], ["1 sets"]])
        #expect(plot.drawn == [
            DatedValue(date: day("2026-09-08", 0), value: 2),
            DatedValue(date: day("2026-09-28", 0), value: 3.5),
        ])
        #expect(plot.drawnUnit == .weekOfYear)
        #expect(plot.average == 2.75)
        #expect(plot.second == 9)
    }

    @Test func plotWeighInRowsDeleteOnlyAppEntries() {
        let logged = BodyWeight(weightKg: 80, measuredAt: day("2026-10-06"))
        let weighIns = [
            WeighIn(date: day("2026-10-06"), kg: 80, source: .app(logged.id)),
            WeighIn(date: day("2026-10-05"), kg: 80.5, source: .health),
            WeighIn(date: day("2026-08-01"), kg: 82, source: .health),
        ]
        let tab = MetricTab(title: "Scale Weight", points: [], unit: "kg", averageTitle: "Average", summary: .change, style: .line, color: DashboardColor.scale)
        let plot = MetricPlot(tab: tab, footer: .weighIns(weighIns), range: .oneMonth, averaging: .daily, now: day("2026-10-07"), calendar: utc, unit: .kg)
        let rows = plot.months.flatMap(\.rows)
        #expect(rows.map(\.text) == ["80 kg", "80.5 kg", "82 kg"])
        #expect(rows.map(\.deletableID) == [logged.id, nil, nil])
        #expect(rows[1].subtitle.hasSuffix(" · Health"))
    }

    @Test func recentRecordsAreTheNewestRecordPerExercise() {
        let sessions = [
            session("2026-10-01", [BlockExercise(exerciseID: "press", sets: [logged(100, 5)]), BlockExercise(exerciseID: "curl", sets: [logged(10, 10)])]),
            session("2026-10-03", [BlockExercise(exerciseID: "press", sets: [logged(90, 5)])]),
            session("2026-10-05", [BlockExercise(exerciseID: "curl", sets: [logged(12, 10)])]),
            session("2026-10-07", [BlockExercise(exerciseID: "press", sets: [logged(105, 5)])]),
        ]
        let records = DashboardMetrics.recentRecords(sessions, kind: .volume, catalog: catalog)
        #expect(records == [
            .init(exerciseID: "press", value: 525, date: day("2026-10-07", 18)),
            .init(exerciseID: "curl", value: 240, date: day("2026-10-05", 18)),
        ])
        let reps = DashboardMetrics.recentRecords(sessions, kind: .reps, catalog: catalog)
        #expect(reps.map(\.date) == [day("2026-10-01", 18), day("2026-10-01", 18)])
    }

    @Test func cycleRingsCountTheActiveCycleAgainstItsPlan() {
        let template = WorkoutTemplate(name: "A", blocks: [
            WorkoutBlock(exercises: [BlockExercise(exerciseID: "press", sets: [WorkoutSet(type: .warmUp), WorkoutSet(), WorkoutSet(), WorkoutSet()])]),
            WorkoutBlock(exercises: [BlockExercise(exerciseID: "curl", sets: [WorkoutSet(), WorkoutSet()])]),
        ])
        var program = Program(name: "P", color: .blue, cycles: 4, days: [ProgramDay(templateID: template.id), ProgramDay(), ProgramDay(templateID: template.id)])
        program.currentCycle = 2
        let position = ProgramPosition(programID: program.id, dayID: program.days[0].id, cycle: 2)
        let sessions = [
            session("2026-10-05", [BlockExercise(exerciseID: "press", sets: [logged(80, 8), logged(80, 8)])], program: position),
            session("2026-10-06", [BlockExercise(exerciseID: "curl", sets: [logged(10, 10)])]),
            session("2026-09-28", [BlockExercise(exerciseID: "curl", sets: [logged(10, 10)])], program: ProgramPosition(programID: program.id, dayID: program.days[0].id, cycle: 1)),
        ]
        let active = DashboardMetrics.cycleProgress(.activeProgram, program: program, templates: [template], sessions: sessions, now: day("2026-10-07"), calendar: utc, catalog: catalog)
        #expect(active == .init(muscles: .init(done: 3, target: 4), sets: .init(done: 2, target: 10), exercises: .init(done: 1, target: 4)))
        #expect(active.sets.left == 8)
        let week = DashboardMetrics.cycleProgress(.allWorkouts, program: nil, templates: [], sessions: sessions, now: day("2026-10-07"), calendar: utc, catalog: catalog)
        #expect(week == .init(muscles: .init(done: 4, target: nil), sets: .init(done: 3, target: nil), exercises: .init(done: 2, target: nil)))
    }

    @Test func habitGridIsOldestFirstEndingToday() {
        let dates = [day("2026-10-07", 6), day("2026-10-07", 20), day("2026-10-05"), day("2026-09-01")]
        let grid = DashboardMetrics.habitDays(dates, count: 4, now: day("2026-10-07", 12), calendar: utc)
        #expect(grid == [false, true, false, true])
        #expect(DashboardMetrics.daysThisWeek(dates, now: day("2026-10-07"), calendar: utc) == 2)
    }

    @Test func weeklyAveragingMeansTheDaysWithData() {
        let daily = DailyCombine.sum.combine([
            DatedValue(date: day("2026-10-05", 7), value: 3),
            DatedValue(date: day("2026-10-05", 19), value: 5),
            DatedValue(date: day("2026-10-07"), value: 4),
            DatedValue(date: day("2026-10-12"), value: 10),
        ], calendar: utc)
        #expect(daily.map(\.value) == [8, 4, 10])
        let weekly = Averaging.weekly.bucket(daily, calendar: utc)
        #expect(weekly == [DatedValue(date: day("2026-10-05", 0), value: 6), DatedValue(date: day("2026-10-12", 0), value: 10)])
        let range = ChartRange.oneWeek.interval(endingAt: day("2026-10-12", 15), earliest: nil, calendar: utc)
        #expect(range == DateInterval(start: day("2026-10-06", 0), end: day("2026-10-13", 0)))
        #expect(daily.inside(range).map(\.value) == [4, 10])
    }
}
