import Foundation
import Testing
@testable import App

@MainActor
struct LoadingCacheTests {
    private let catalog = ExerciseCatalog()
    private let bench = BlockExercise(exerciseID: "19f5c6f170d8808bb424e98de4472a7e", sets: [])
    private let barbell: EquipmentID = "19e5c6f170d8801cac93cf6853bd86b8"

    private func gym(_ unit: WeightUnit) -> GymProfile {
        GymProfile(name: "Your Gym", equipment: GymTemplate.commercial.equipment(from: catalog.equipment, unit: unit))
    }

    @Test func answersTheGymsBarAndPlates() throws {
        let cache = LoadingCache()
        let answer = cache.answer(for: bench, gym: gym(.lb), catalog: catalog, settings: AppSettings(), exerciseSettings: [])
        let plates = try #require(answer.loading?.plates)
        #expect(plates.plan(for: 185).sentence(unit: "lb") == "70 lb on both sides + 45 lb bar weight = 185 lb")
        #expect(answer.loadable.lightest == 45)
        #expect(answer.loadable.nearest(186) == 185)
    }

    @Test func aSettingsChangeRecomputes() throws {
        let cache = LoadingCache()
        let gym = gym(.kg)
        var settings = AppSettings()
        settings.weightUnit = .kg
        #expect(cache.answer(for: bench, gym: gym, catalog: catalog, settings: settings, exerciseSettings: []).loading?.plates?.baseWeight == 20)
        var override = ExerciseSettings(id: bench.exerciseID)
        override.overrides.barWeightKg = [barbell: 15]
        let answer = cache.answer(for: bench, gym: gym, catalog: catalog, settings: settings, exerciseSettings: [override])
        #expect(answer.loading?.plates?.baseWeight == 15)
        settings.weightUnit = .lb
        let lb = try #require(cache.answer(for: bench, gym: gym, catalog: catalog, settings: settings, exerciseSettings: [override]).loading?.plates)
        #expect((lb.baseWeight * 100).rounded() == 3307)
    }

    @Test func eachGymKeepsItsOwnAnswers() {
        let cache = LoadingCache()
        let empty = GymProfile(name: "Empty", equipment: [:])
        #expect(cache.answer(for: bench, gym: gym(.lb), catalog: catalog, settings: AppSettings(), exerciseSettings: []).loadable.lightest == 45)
        #expect(cache.answer(for: bench, gym: empty, catalog: catalog, settings: AppSettings(), exerciseSettings: []).loading?.plates?.plates == [])
        #expect(cache.answer(for: bench, gym: gym(.lb), catalog: catalog, settings: AppSettings(), exerciseSettings: []).loadable.lightest == 45)
    }
}
