import Testing
@testable import App

struct ExerciseOverrideTests {
    @Test func aNoteAndDoNotRecommendAloneAreNotModified() {
        var settings = ExerciseSettings(id: "bench", pinnedNote: "Pause on the chest")
        settings.doNotRecommend = true
        #expect(settings.isModified == false)
    }

    @Test func aRestTimerOrAnyOverrideIsModified() {
        #expect(ExerciseSettings(id: "bench", restSeconds: 150).isModified == true)
        var weightMatch = ExerciseSettings(id: "bench")
        weightMatch.overrides.weightMatch = false
        #expect(weightMatch.isModified == true)
        var scheme = ExerciseSettings(id: "bench")
        scheme.overrides.warmUpScheme = []
        #expect(scheme.isModified == true)
    }

    @Test func rowSummariesShowDefaultOrTheOverriddenValue() {
        var settings = ExerciseSettings(id: "bench", restSeconds: 150)
        settings.overrides.expandRepRange = false
        settings.overrides.warmUpAutomation = .scheme
        settings.overrides.warmUpScheme = [WarmUpStep(percent: 50, reps: 8), WarmUpStep(percent: 75, reps: 3)]
        settings.overrides.equipment = ["dumbbells": .weights(options: [WeightOption(kg: 10)])]
        let summaries = ExerciseOverrideRow.allCases.map { $0.summary(settings) }
        #expect(summaries == ["1 item overridden", "2:30", "Default", "Off", "Default", "Scheme Warm-Up", "50% x 8, 75% x 3"])
        #expect(ExerciseOverrideRow.allCases.map { $0.summary(nil) } == Array(repeating: "Default", count: 7))
    }
}
