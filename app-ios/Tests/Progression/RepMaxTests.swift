import Testing
@testable import App

struct RepMaxTests {
    func rounded(_ value: Double) -> Double { (value * 100).rounded() / 100 }

    @Test func epleyInverseFrom100x10() {
        #expect(rounded(WorkoutMetrics.estimatedRepMaxKg(for: 1, weightKg: 100, reps: 10, rir: 0)) == 133.33)
        #expect(rounded(WorkoutMetrics.estimatedRepMaxKg(for: 3, weightKg: 100, reps: 10, rir: 0)) == 121.21)
        #expect(rounded(WorkoutMetrics.estimatedRepMaxKg(for: 10, weightKg: 100, reps: 10, rir: 0)) == 100)
    }
}
