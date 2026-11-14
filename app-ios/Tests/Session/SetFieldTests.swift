import Testing
@testable import App

struct SetFieldTests {
    @Test func weightComesFirstWhenTheCatalogListsRepsFirst() {
        #expect(SetField.fields(for: [.repsPerSide, .weightPerSide]) == [.weight(perSide: true), .reps(perSide: true)])
        #expect(SetField.fields(for: [.reps, .assistanceWeight]) == [.weight(perSide: false), .reps(perSide: false)])
        #expect(SetField.fields(for: [.weightPerSidePersistent, .repsPerSide]) == [.weight(perSide: true), .reps(perSide: true)])
    }

    @Test func weightPrecedesDurationAndDistance() {
        #expect(SetField.fields(for: [.durationPerSide, .weightPerSidePersistent]) == [.weight(perSide: true), .duration(perSide: true)])
        #expect(SetField.fields(for: [.distanceShort, .weightPerSide]) == [.weight(perSide: true), .distance(long: false)])
        #expect(SetField.fields(for: [.duration, .distanceLong]) == [.duration(perSide: false), .distance(long: true)])
    }

    @Test func singleMetricExercisesKeepTheirOneColumn() {
        #expect(SetField.fields(for: [.reps]) == [.reps(perSide: false)])
        #expect(SetField.fields(for: []) == [])
    }

    @Test func anUnknownExerciseLogsWeightThenReps() {
        #expect(SetField.fields(for: nil as Exercise?) == [.weight(perSide: false), .reps(perSide: false)])
    }
}
