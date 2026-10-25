import Foundation
import Testing
@testable import App

/// The segments and effort score saved with a workout, from its logged sets.
struct HealthRecordingPlanTests {
    private static let start = Date(timeIntervalSince1970: 1_000_000)

    private static func at(_ minutes: Double) -> Date { start.addingTimeInterval(minutes * 60) }

    private static func set(_ minutes: Double?, rir: Int? = nil, type: SetType = .standard) -> WorkoutSet {
        WorkoutSet(type: type, log: minutes.map { SetLog(reps: 8, rir: rir, completedAt: at($0)) })
    }

    @Test func eachExerciseSegmentRunsFromTheSetBeforeItToItsLastSet() {
        let blocks = [
            WorkoutBlock(exercises: [BlockExercise(exerciseID: "bench", sets: [Self.set(3), Self.set(6)])]),
            WorkoutBlock(exercises: [BlockExercise(exerciseID: "row", sets: [Self.set(10), Self.set(13), Self.set(nil)])]),
            WorkoutBlock(exercises: [BlockExercise(exerciseID: "curl", sets: [Self.set(nil)])]),
        ]
        let segments = HealthRecordingPlan.segments(in: blocks, startedAt: Self.start) { $0 }
        #expect(segments == [
            .init(exercise: "bench", start: Self.at(0), end: Self.at(6)),
            .init(exercise: "row", start: Self.at(6), end: Self.at(13)),
        ])
    }

    @Test func supersetSegmentsOverlap() {
        let blocks = [WorkoutBlock(exercises: [
            BlockExercise(exerciseID: "press", sets: [Self.set(2), Self.set(6)]),
            BlockExercise(exerciseID: "pulldown", sets: [Self.set(4), Self.set(8)]),
        ])]
        let segments = HealthRecordingPlan.segments(in: blocks, startedAt: Self.start) { $0 }
        #expect(segments == [
            .init(exercise: "press", start: Self.at(0), end: Self.at(6)),
            .init(exercise: "pulldown", start: Self.at(2), end: Self.at(8)),
        ])
    }

    @Test func effortIsTenMinusTheWorkingSetsAverageRIR() {
        let blocks = [WorkoutBlock(exercises: [BlockExercise(exerciseID: "bench", sets: [
            Self.set(1, rir: 6, type: .warmUp), Self.set(3, rir: 3), Self.set(6, rir: 2), Self.set(9, rir: 1), Self.set(nil, rir: 0),
        ])])]
        #expect(HealthRecordingPlan.effort(in: blocks) == 8)
    }

    @Test func noLoggedRIRMeansNoEffort() {
        let blocks = [WorkoutBlock(exercises: [BlockExercise(exerciseID: "bench", sets: [Self.set(3), Self.set(6)])])]
        #expect(HealthRecordingPlan.effort(in: blocks) == nil)
    }
}
