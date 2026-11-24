import Foundation
import Testing
@testable import Core

private let lb = WeightUnit.lb
private let smith = PlateLoading(base: .bar, baseWeight: 13, plates: [45.0, 25, 10, 5, 2.5].map { .init(weight: $0, perSide: nil) }, sides: 2)

struct LivePlatesTests {
    @Test func theWatchReadsThePhonesLegendForTheLoggedKilograms() {
        let plates = LivePlates(smith, offset: nil, togglesBase: false)
        #expect(plates.plan(weightKg: lb.toKg(133), unit: lb)?.legend == "45 10 5 + 13 bar")
        #expect(plates.plan(weightKg: lb.toKg(123), unit: lb)?.legend == "45 10 + 13 bar")
        #expect(plates.plan(weightKg: lb.toKg(123), unit: lb)?.miss(unit: "lb") == nil)
    }

    @Test func theCalculatorOffsetMovesTheTarget() {
        let plates = LivePlates(smith, offset: .kilograms(lb.toKg(10)), togglesBase: false)
        #expect(plates.plan(weightKg: lb.toKg(123), unit: lb)?.legend == "45 10 5 + 13 bar")
    }

    @Test func aLeftOutBarLoadsThePlatesAloneAndStillNamesTheBar() {
        var leftOut = smith
        leftOut.baseWeight = 0
        leftOut.ignoredBaseWeight = 13
        let plan = LivePlates(leftOut, offset: nil, togglesBase: true).plan(weightKg: lb.toKg(100), unit: lb)
        #expect(plan?.legend == "45 5")
        #expect(plan?.ignoredBaseLabel == "13 bar")
    }

    @Test func aWorkoutFromAnOlderPhoneDecodesWithoutPlates() throws {
        let old = #"{"name":"Lat Pulldown","fields":["weight","reps"],"loadableWeightsKg":[]}"#
        let exercise = try JSONDecoder().decode(WatchWorkout.Exercise.self, from: Data(old.utf8))
        #expect(exercise.plates == nil)
        let sent = WatchWorkout.Exercise(name: "Smith Machine Bench Press", fields: [.weight, .reps], plates: LivePlates(smith, offset: .percent(-10), togglesBase: false))
        let received = try JSONDecoder().decode(WatchWorkout.Exercise.self, from: JSONEncoder().encode(sent))
        #expect(received == sent)
        #expect(received.plates?.loading == smith)
    }
}
