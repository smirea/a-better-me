import Testing
@testable import App

struct SmartWarmUpTests {
    @Test func curlAt40x8GetsTwoStepsBelowTheWorkingWeight() {
        let steps = SmartWarmUp.steps(workingWeight: 40, reps: 8, rir: 0, increment: 5, unit: .lb, isFresh: true, simplifyPlates: false)
        #expect(steps == [SmartWarmUp.Step(percent: 40, weight: 20, reps: 8), SmartWarmUp.Step(percent: 63, weight: 30, reps: 5)])
    }

    @Test func simplifiedPlatesLandOnTheSameCurlWeights() {
        let steps = SmartWarmUp.steps(workingWeight: 40, reps: 8, rir: 0, increment: 5, unit: .lb, isFresh: true, simplifyPlates: true)
        #expect(steps.map(\.weight) == [20, 30])
    }

    @Test func heavyDoubleGetsTheFullLadderAndNotFreshDropsTheLightest() {
        let fresh = SmartWarmUp.steps(workingWeight: 100, reps: 2, rir: 0, increment: 2.5, unit: .kg, isFresh: true, simplifyPlates: false)
        #expect(fresh.map(\.weight) == [42.5, 67.5, 85, 95])
        #expect(fresh.map(\.reps) == [8, 5, 3, 1])
        let warm = SmartWarmUp.steps(workingWeight: 100, reps: 2, rir: 0, increment: 2.5, unit: .kg, isFresh: false, simplifyPlates: false)
        #expect(warm.map(\.weight) == [67.5, 85, 95])
    }

    @Test func fiveAtTwoRIRStopsBeforeTheNinetyPercentStep() {
        let steps = SmartWarmUp.steps(workingWeight: 100, reps: 5, rir: 2, increment: 2.5, unit: .kg, isFresh: true, simplifyPlates: false)
        #expect(steps.map(\.weight) == [50, 77.5, 97.5])
    }
}

struct WarmUpSchemeTests {
    @Test func standardSchemeAt100kg() {
        let steps = WarmUpScheme.sets(workingWeight: 100, increment: 2.5, steps: WarmUpStep.standard)
        #expect(steps.map(\.weight) == [40, 60, 80])
        #expect(steps.map(\.reps) == [5, 5, 3])
    }

    @Test func standardSchemeRoundsToTheIncrement() {
        let steps = WarmUpScheme.sets(workingWeight: 102.5, increment: 2.5, steps: WarmUpStep.standard)
        #expect(steps.map(\.weight) == [40, 62.5, 82.5])
    }

    @Test func incrementPerUnit() {
        #expect(WarmUpScheme.increment(for: .kg) == 2.5)
        #expect(WarmUpScheme.increment(for: .lb) == 5)
    }
}
