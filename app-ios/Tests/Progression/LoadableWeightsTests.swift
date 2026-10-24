import Foundation
import Testing
@testable import App

private let lb = WeightUnit.lb

/// A 45 lb bar with 45s and 25s, and one pair each of 10s, 5s, and 2.5s: 85 lb (20 a side) can't be loaded.
private let barbell = LoadableWeights(loading: .plates(PlateLoading(base: .bar, baseWeight: 45, plates: [
    .init(weight: 45, perSide: nil), .init(weight: 25, perSide: nil),
    .init(weight: 10, perSide: 1), .init(weight: 5, perSide: 1), .init(weight: 2.5, perSide: 1),
], sides: 2)), unit: lb)

/// A home rack without 30s.
private let rack = LoadableWeights(loading: .steps([5, 10, 15, 20, 25, 35, 40, 50]), unit: lb)

private func logged(_ weightLb: Double, _ reps: Int, _ rir: Int) -> SetLog {
    SetLog(weightKg: lb.toKg(weightLb), reps: reps, rir: rir, completedAt: Date(timeIntervalSinceReferenceDate: 0))
}

private func warmUps(_ workingLb: Double, reps: Int, mode: WarmUpMode, simplify: Bool, loadable: LoadableWeights = barbell) -> [Double] {
    let context = WarmUpContext(loadable: loadable, workingWeightKg: lb.toKg(workingLb), reps: reps, rir: 0, simplifyPlates: simplify)
    return SessionFlow.warmUps(context, mode: mode, unit: lb).map { (lb.fromKg($0.weightKg) * 100).rounded() / 100 }
}

struct LoadableProgressionTests {
    @Test func barbellSuggestionDropsToTheHeaviestLoadableWeight() {
        var drop = WorkoutSet(type: .drop, target: SetTarget(repsMin: 8, repsMax: 12, rir: 2))
        drop.subSets = [SubSet()]
        let previous = [WorkoutSet(type: .drop, log: logged(205, 10, 0))]
        let result = SmartProgression.suggest(sets: [drop], previous: previous, settings: ProgressionSettings(), loadable: barbell, rirTracking: true, unit: lb)
        // The increment alone gives 175, which needs 20 lb a side past the 45s.
        #expect(result[drop.id]?.autoText(unit: lb) == "170 lb x 8-12 / 2 RIR")
        #expect(result[drop.id]?.prefill == SetSuggestion.Values(weight: 170, reps: 12, rir: 2))
        // Half of 170 is the unloadable 85; 80 is closer than 95.
        #expect(result[drop.subSets[0].id]?.weight == 80)
    }

    @Test func dumbbellSuggestionSkipsTheMissingDumbbell() {
        let sets = CurlFixture.sets
        #expect(CurlFixture.suggest(sets: sets)[sets[1].id]?.weight == 30)
        let racked = SmartProgression.suggest(sets: sets, previous: CurlFixture.previous, settings: ProgressionSettings(), loadable: rack, rirTracking: true, unit: lb)
        #expect(racked[sets[0].id]?.prefill == SetSuggestion.Values(weight: 40, reps: 9, rir: 0))
        #expect(racked[sets[0].subSets[0].id]?.weight == 20)
        // 30 lb dumbbells are missing, and 25 lb predicts 13 reps, past the 8-12 target.
        #expect(racked[sets[1].id]?.prefill == SetSuggestion.Values(weight: 25, reps: 13, rir: 2))
        #expect(racked[sets[1].id]?.adjustedReps == 8...13)
        #expect(racked[sets[2].id]?.prefill == SetSuggestion.Values(weight: 25, reps: 12, rir: 2))
    }

    @Test func applyInSessionSnapsToo() {
        var sets = CurlFixture.sets
        sets[1].log = CurlFixture.logged(45, 8, 0, at: 60)
        let changed = SmartProgression.applyInSession(sets: sets, current: [:], settings: ProgressionSettings(), loadable: rack, rirTracking: true, unit: lb)
        // 45 x 8 @0 caps the next set at 33 lb: the increment gives 30, which the rack lacks.
        #expect(changed[sets[2].id]?.weight == 25)
    }
}

struct LoadableWarmUpTests {
    @Test func smartStepsLandOnLoadableBarbellWeights() {
        // 185 x 5 estimates a 215.83 lb 1-RM: 40%, 63%, and 80% are 86.33, 135.98, and 172.67.
        #expect(warmUps(185, reps: 5, mode: .smart, simplify: false) == [80, 135, 170])
        #expect(warmUps(185, reps: 5, mode: .smart, simplify: true) == [95, 135])
    }

    @Test func schemeStepsLandOnLoadableBarbellWeights() {
        // 40%, 60%, and 80% of 185 are 74, 111, and 148.
        #expect(warmUps(185, reps: 5, mode: .scheme, simplify: false) == [75, 110, 150])
        #expect(warmUps(185, reps: 5, mode: .scheme, simplify: true) == [65, 115, 155])
    }

    @Test func dumbbellStepsSkipTheMissingDumbbell() {
        // 40 x 8 estimates 50.67: 40% is 20.27 and 63% is 31.92, between the 25s and the 35s.
        #expect(warmUps(40, reps: 8, mode: .smart, simplify: false, loadable: rack) == [20, 35])
        #expect(warmUps(40, reps: 8, mode: .smart, simplify: false, loadable: LoadableWeights(loading: nil, unit: lb)) == [20, 30])
    }

    @Test func stepsThatSnapTogetherAppearOnce() {
        // 40%, 60%, and 80% of 100 all snap to the empty 45 lb bar, the closest of 45, 135, and 225.
        let bar = LoadableWeights(loading: .plates(PlateLoading(base: .bar, baseWeight: 45, plates: [.init(weight: 45, perSide: nil)], sides: 2)), unit: lb)
        #expect(warmUps(100, reps: 5, mode: .scheme, simplify: false, loadable: bar) == [45])
    }
}
