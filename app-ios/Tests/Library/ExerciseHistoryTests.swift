import Foundation
import Testing
@testable import App

struct EstimatedRepMaxTests {
    @Test func inverseEpleyFromA120KilogramOneRepMax() {
        #expect(abs(WorkoutMetrics.estimatedRepMaxKg(oneRepMaxKg: 120, reps: 3) - 109.090909) < 0.0001)
        #expect(abs(WorkoutMetrics.estimatedRepMaxKg(oneRepMaxKg: 120, reps: 10) - 90) < 0.0001)
    }

    @Test func oneRepOrFewerIsTheOneRepMax() {
        #expect(WorkoutMetrics.estimatedRepMaxKg(oneRepMaxKg: 120, reps: 1) == 120)
        #expect(WorkoutMetrics.estimatedRepMaxKg(oneRepMaxKg: 120, reps: 0) == 120)
    }
}

struct ExerciseHistoryArrangementTests {
    let bench = Exercise(id: "bench", name: "Bench Press", type: .compound, primaryMuscles: [.chest], metrics: [.weight, .reps])

    static func day(_ day: Int) -> Date {
        Calendar(identifier: .gregorian).date(from: DateComponents(timeZone: .gmt, year: 2026, month: 1, day: day))!
    }

    static func entry(_ name: String, day: Int, weightKg: Double?, reps: Int, records: [HistoryMetric: Double] = [:]) -> ExerciseHistoryEntry {
        let log = SetLog(weightKg: weightKg, reps: reps, completedAt: Self.day(day))
        return ExerciseHistoryEntry(id: UUID(), date: Self.day(day), workoutName: name, sets: [WorkoutSet(log: log)], records: records)
    }

    /// 1-RMs: A 121 (110 x 3), B 116.67 (100 x 5), C none (no weight), D 120 (120 x 1). Newest first, as `entries` returns.
    let newestFirst = [
        entry("D", day: 22, weightKg: 120, reps: 1, records: [.totalVolume: 120]),
        entry("C", day: 15, weightKg: nil, reps: 12),
        entry("B", day: 8, weightKg: 100, reps: 5),
        entry("A", day: 1, weightKg: 110, reps: 3, records: [.oneRepMax: 121]),
    ]

    func names(_ sort: HistorySort, _ records: RecordsFilter = .on, metric: HistoryMetric = .oneRepMax) -> [String] {
        ExerciseHistory.arranged(newestFirst, sort: sort, records: records, metric: metric, exercise: bench).map(\.workoutName)
    }

    @Test func sortsByDate() {
        #expect(names(.mostRecent) == ["D", "C", "B", "A"])
        #expect(names(.oldest) == ["A", "B", "C", "D"])
    }

    @Test func sortsByTheSelectedMetricWithMissingValuesLast() {
        #expect(names(.highest) == ["A", "D", "B", "C"])
        #expect(names(.lowest) == ["B", "D", "A", "C"])
        #expect(names(.highest, metric: .totalReps) == ["C", "B", "A", "D"])
    }

    @Test func recordsOnlyKeepsSessionsWithARecord() {
        #expect(names(.mostRecent, .only) == ["D", "A"])
        #expect(names(.lowest, .only) == ["D", "A"])
        #expect(names(.mostRecent, .off) == ["D", "C", "B", "A"])
    }

    @Test func repMaxMetricsComeFromTheBestSetsOneRepMax() throws {
        let a = newestFirst[3], d = newestFirst[0]
        #expect(abs(try #require(HistoryMetric.threeRepMax.value(of: a, exercise: bench)) - 110) < 0.0001)
        #expect(abs(try #require(HistoryMetric.tenRepMax.value(of: d, exercise: bench)) - 90) < 0.0001)
        #expect(HistoryMetric.tenRepMax.value(of: newestFirst[1], exercise: bench) == nil)
    }
}
