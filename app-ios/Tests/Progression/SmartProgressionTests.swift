import Foundation
import Testing
@testable import App

struct SmartProgressionTests {
    let sets = CurlFixture.sets
    let lb = WeightUnit.lb

    @Test func dropSetProgressesTo40x9AndWidensTheRange() {
        let result = CurlFixture.suggest(sets: sets)
        let drop = result[sets[0].id]!
        #expect(drop.weight == 40)
        #expect(drop.autoText(unit: lb) == "40 lb x 8 / 0 RIR")
        #expect(drop.adjustedReps == 8...9)
        #expect(drop.prefill == SetSuggestion.Values(weight: 40, reps: 9, rir: 0))
    }

    @Test func workingSetsDropTo30AndPrefillTheTopOfTheRange() {
        let result = CurlFixture.suggest(sets: sets)
        for set in sets.dropFirst() {
            let suggestion = result[set.id]!
            #expect(suggestion.autoText(unit: lb) == "30 lb x 8-12 / 2 RIR")
            #expect(suggestion.adjustedReps == nil)
            #expect(suggestion.prefill == SetSuggestion.Values(weight: 30, reps: 12, rir: 2))
        }
    }

    @Test func dropSubRowHalvesTheWeightWithEmptyReps() {
        let result = CurlFixture.suggest(sets: sets)
        let sub = result[sets[0].subSets[0].id]!
        #expect(sub.autoText(unit: lb) == "20 lb / 0 RIR")
        #expect(sub.prefill == SetSuggestion.Values(weight: 20, reps: nil, rir: 0))
    }

    @Test func eventLogListsTheMainRowsWithPrefilledValues() {
        let result = CurlFixture.suggest(sets: sets)
        let at = Date(timeIntervalSinceReferenceDate: 54_060)
        let event = SmartProgression.event(at: at, sets: sets, suggestions: result)
        #expect(event.at == at)
        #expect(event.rows.map(\.label) == ["D Set 1", "2 Set 2", "3 Set 3"])
        #expect(event.rows.map { $0.text(unit: lb) } == ["40 lb x 9 (0)", "30 lb x 12 (2)", "30 lb x 12 (2)"])
    }

    @Test func expandRepRangeOffKeepsTheTargetAndPrefills8() {
        var settings = ProgressionSettings()
        settings.expandRepRange = false
        let drop = CurlFixture.suggest(sets: sets, settings: settings)[sets[0].id]!
        #expect(drop.weight == 40)
        #expect(drop.adjustedReps == nil)
        #expect(drop.prefill.reps == 8)
    }

    @Test func rirTrackingOffPrefillsThePreviousRIR() {
        let result = CurlFixture.suggest(sets: sets, rirTracking: false)
        #expect(result[sets[1].id]!.prefill.rir == 1)
        #expect(result[sets[2].id]!.prefill.rir == 0)
    }

    @Test func weightMatchReusesThePriorRowWhenItsRepsFitTheTarget() {
        var previous = CurlFixture.previous
        previous[2].log = CurlFixture.logged(35, 8, 0)
        var settings = ProgressionSettings()
        #expect(CurlFixture.suggest(sets: sets, previous: previous)[sets[2].id]!.weight == 25)
        settings.weightMatch = true
        let matched = CurlFixture.suggest(sets: sets, previous: previous, settings: settings)
        #expect(matched[sets[2].id]!.weight == 30)
        #expect(matched[sets[2].id]!.weight == matched[sets[1].id]!.weight)
        #expect(matched[sets[0].id]!.weight == 40)
        #expect(matched[sets[1].id]!.weight == 30)
    }

    @Test func noPreviousCopiesTheTargetWeightOrTheRowAbove() {
        var sets = CurlFixture.sets
        sets[0].target?.weightKg = lb.toKg(50)
        sets.append(WorkoutSet(target: SetTarget(repsMin: 8, repsMax: 12, rir: 2)))
        let result = CurlFixture.suggest(sets: sets, previous: [])
        #expect(result[sets[0].id]!.prefill == SetSuggestion.Values(weight: 50, reps: 8, rir: 0))
        #expect(result[sets[0].subSets[0].id]!.weight == 25)
        #expect(result[sets[1].id]!.weight == 50)
        #expect(result[sets[3].id]!.prefill == SetSuggestion.Values(weight: 50, reps: 12, rir: 2))
    }

    @Test func noTargetKeepsThePreviousLog() {
        let sets = [WorkoutSet()]
        let result = CurlFixture.suggest(sets: sets, previous: [WorkoutSet(log: CurlFixture.logged(35, 10, 1))])
        #expect(result[sets[0].id]!.autoText(unit: lb) == "35 lb x 10")
        #expect(result[sets[0].id]!.prefill == SetSuggestion.Values(weight: 35, reps: 10, rir: 1))
    }

    @Test func applyInSessionRecomputesOpenRowsFromTheLoggedSet() {
        var sets = CurlFixture.sets
        let current = CurlFixture.suggest(sets: sets)
        sets[0].log = CurlFixture.logged(40, 9, 0, at: 10)
        var expected = current
        expected[sets[1].id]!.prefill.weight = 25
        let changed = SmartProgression.applyInSession(sets: sets, current: expected, settings: ProgressionSettings(), loadable: CurlFixture.loadable, rirTracking: true, unit: lb)
        #expect(Set(changed.keys) == [sets[1].id])
        #expect(changed[sets[1].id]!.autoText(unit: lb) == "30 lb x 8-12 / 2 RIR")
        #expect(changed[sets[1].id]!.prefill == SetSuggestion.Values(weight: 30, reps: 12, rir: 2))
    }

    @Test func applyInSessionMovesOpenRowsWhenTheLoggedSetDiffers() {
        var sets = CurlFixture.sets
        let current = CurlFixture.suggest(sets: sets)
        sets[0].log = CurlFixture.logged(40, 12, 1, at: 10)
        let changed = SmartProgression.applyInSession(sets: sets, current: current, settings: ProgressionSettings(), loadable: CurlFixture.loadable, rirTracking: true, unit: lb)
        #expect(Set(changed.keys) == [sets[1].id, sets[2].id])
        #expect(changed[sets[1].id]!.prefill == SetSuggestion.Values(weight: 40, reps: 12, rir: 2))
        #expect(changed[sets[1].id]!.adjustedReps == nil)
    }

    @Test func applyInSessionLeavesWarmUpsAlone() {
        var sets = [WorkoutSet(type: .warmUp)] + CurlFixture.sets
        let previous = [WorkoutSet(type: .warmUp, log: CurlFixture.logged(20, 8, nil))] + CurlFixture.previous
        let current = CurlFixture.suggest(sets: sets, previous: previous)
        #expect(current[sets[0].id]!.prefill == SetSuggestion.Values(weight: 20, reps: 8, rir: nil))
        sets[1].log = CurlFixture.logged(40, 12, 1, at: 10)
        let changed = SmartProgression.applyInSession(sets: sets, current: current, settings: ProgressionSettings(), loadable: CurlFixture.loadable, rirTracking: true, unit: CurlFixture.lb)
        #expect(Set(changed.keys) == [sets[2].id, sets[3].id])
        let event = SmartProgression.event(at: .now, sets: sets, suggestions: current)
        #expect(event.rows.map(\.label) == ["D Set 1", "2 Set 2", "3 Set 3"])
    }

    @Test func calculatedWarmUpKeepsItsTargetWeight() {
        let sets = [WorkoutSet(type: .warmUp, target: SetTarget(repsMin: 8, repsMax: 8, weightKg: CurlFixture.lb.toKg(10)))] + CurlFixture.sets
        let previous = [WorkoutSet(type: .warmUp, log: CurlFixture.logged(20, 8, nil))] + CurlFixture.previous
        let result = CurlFixture.suggest(sets: sets, previous: previous)
        #expect(result[sets[0].id]!.prefill == SetSuggestion.Values(weight: 10, reps: 8, rir: nil))
        #expect(result[sets[1].id]!.weight == 40)
    }

    @Test func zeroWeightHistoryFallsBackToThePreviousLog() {
        let sets = [WorkoutSet(target: SetTarget(repsMin: 8, repsMax: 12, rir: 2))]
        let result = CurlFixture.suggest(sets: sets, previous: [WorkoutSet(log: CurlFixture.logged(0, 10, 1))])
        #expect(result[sets[0].id]!.prefill == SetSuggestion.Values(weight: 0, reps: 12, rir: 2))
        #expect(result[sets[0].id]!.adjustedReps == nil)
    }
}
