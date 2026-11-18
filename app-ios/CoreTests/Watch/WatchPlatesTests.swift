import Foundation
import Testing
@testable import Core

private let lb = WeightUnit.lb
private let smith = PlateLoading(base: .bar, baseWeight: 13, plates: [45.0, 25, 10, 5, 2.5].map { .init(weight: $0, perSide: nil) }, sides: 2)

struct WatchPlatesTests {
    @Test func theWatchReadsThePhonesLegendForTheLoggedKilograms() {
        let plates = WatchPlates(smith, offset: nil)
        #expect(plates.plan(weightKg: lb.toKg(133), unit: lb)?.legend == "45 10 5 + 13 bar")
        #expect(plates.plan(weightKg: lb.toKg(123), unit: lb)?.legend == "45 10 + 13 bar")
        #expect(plates.plan(weightKg: lb.toKg(123), unit: lb)?.miss(unit: "lb") == nil)
    }

    @Test func theCalculatorOffsetMovesTheTarget() {
        let plates = WatchPlates(smith, offset: .kilograms(lb.toKg(10)))
        #expect(plates.plan(weightKg: lb.toKg(123), unit: lb)?.legend == "45 10 5 + 13 bar")
    }

    @Test func aLeftOutBarLeavesTheWatchLineToThePlates() {
        var leftOut = smith
        leftOut.baseWeight = 0
        leftOut.ignoredBaseWeight = 13
        #expect(WatchPlates(leftOut, offset: nil).plan(weightKg: lb.toKg(120), unit: lb)?.legend == "45 10 5")
    }

    @Test func aWorkoutFromAnOlderPhoneDecodesWithoutPlates() throws {
        let old = #"{"name":"Lat Pulldown","fields":["weight","reps"],"loadableWeightsKg":[]}"#
        let exercise = try JSONDecoder().decode(WatchWorkout.Exercise.self, from: Data(old.utf8))
        #expect(exercise.plates == nil)
        let sent = WatchWorkout.Exercise(name: "Smith Machine Bench Press", fields: [.weight, .reps], plates: WatchPlates(smith, offset: .percent(-10)))
        let received = try JSONDecoder().decode(WatchWorkout.Exercise.self, from: JSONEncoder().encode(sent))
        #expect(received == sent)
        #expect(received.plates?.loading == smith)
    }
}
