import Foundation
import Testing
@testable import App

private func item(_ id: String, _ category: String, pluralOf: String? = nil, presets: [GymPreset] = []) -> Equipment {
    Equipment(id: id, name: id, category: category, pluralOf: pluralOf, weightOptionsKg: [], gymPresets: presets, hasImage: false)
}

private let catalog: [EquipmentID: Equipment] = Dictionary(uniqueKeysWithValues: [
    item("dumbbell", "Free Weights", presets: [.home]),
    item("dumbbells", "Free Weights", pluralOf: "dumbbell", presets: [.home]),
    item("ankle-weight", "Body Weights", presets: [.garage]),
    item("ankle-weights", "Body Weights", pluralOf: "ankle-weight"),
    item("barbell", "Loadable Bars", presets: [.garage]),
    item("plate", "Free Weights"),
    item("plates", "Free Weights", pluralOf: "plate", presets: [.garage]),
    item("flat-bench", "Benches & Racks", presets: [.garage, .home]),
    item("power-rack", "Benches & Racks", presets: [.garage]),
    item("bodyweight-only", "Bodyweight"),
].map { ($0.id, $0) })

private func exercise(resistance: [[String]], support: [[String]] = []) -> Exercise {
    Exercise(
        id: "test", name: "Test", type: .compound, primaryMuscles: [.chest], metrics: [.weight, .reps],
        resistanceEquipmentIDs: resistance, supportEquipmentIDs: support
    )
}

private func gym(_ ids: String...) -> GymProfile {
    GymProfile(name: "Test Gym", equipment: Dictionary(uniqueKeysWithValues: ids.map { ($0, GymEquipment(load: nil)) }))
}

struct GymAvailabilityTests {
    @Test func selectedPluralProvidesItsSingular() {
        let availability = GymAvailability(gym: gym("dumbbells"), equipment: catalog)
        #expect(availability.provides("dumbbell"))
        #expect(availability.provides("dumbbells"))
        #expect(!availability.provides("barbell"))
        #expect(availability.isAvailable(exercise(resistance: [["dumbbell"]])))
    }

    @Test func bodyweightIsAvailableInAnEmptyGym() {
        let availability = GymAvailability(gym: gym(), equipment: catalog)
        #expect(availability.provides("bodyweight-only"))
        #expect(availability.isAvailable(exercise(resistance: [["bodyweight-only"]])))
        #expect(availability.isAvailable(exercise(resistance: [])))
    }

    @Test func missingBarbellMakesABarbellExerciseUnavailable() {
        let benchPress = exercise(resistance: [["barbell", "plate"]], support: [["flat-bench", "power-rack"]])
        #expect(GymAvailability.isAvailable(benchPress, in: gym("barbell", "plates", "flat-bench", "power-rack"), equipment: catalog))
        #expect(!GymAvailability.isAvailable(benchPress, in: gym("plates", "flat-bench", "power-rack"), equipment: catalog))
        #expect(!GymAvailability.isAvailable(benchPress, in: gym("barbell", "flat-bench", "power-rack"), equipment: catalog))
    }

    @Test func anyFullyProvidedOptionSatisfiesItsKind() {
        let press = exercise(resistance: [["barbell", "plate"], ["dumbbell"]], support: [["flat-bench", "power-rack"], ["flat-bench"]])
        #expect(GymAvailability.isAvailable(press, in: gym("dumbbells", "flat-bench"), equipment: catalog))
        #expect(!GymAvailability.isAvailable(press, in: gym("dumbbells", "power-rack"), equipment: catalog))
    }

    @Test func emptySupportOptionsNeedNothing() {
        let curl = exercise(resistance: [["dumbbell"]], support: [])
        #expect(GymAvailability.isAvailable(curl, in: gym("dumbbells"), equipment: catalog))
    }

    @Test func templatesSelectTheListedPluralOfAFlaggedSingular() {
        #expect(Set(GymTemplate.garage.equipment(from: catalog, unit: .lb).keys) == ["ankle-weights", "barbell", "plates", "flat-bench", "power-rack"])
        #expect(Set(GymTemplate.home.equipment(from: catalog, unit: .lb).keys) == ["dumbbells", "flat-bench"])
        #expect(Set(GymTemplate.everything.equipment(from: catalog, unit: .lb).keys) == ["dumbbells", "ankle-weights", "barbell", "plates", "flat-bench", "power-rack"])
    }
}

struct GymDefaultsTests {
    private let lb = 0.45359237

    @Test func bundledLoadsDecodeWithTheCapturedDefaults() throws {
        let dumbbells = try #require(GymDefaults.load(for: "19e5c6f170d8808593d8ecf408c4f749"))
        guard case .weights(let options) = dumbbells else { Issue.record("Dumbbells load is \(dumbbells)"); return }
        #expect(options.count == 38)
        #expect(abs(options[0].kg - 2.5 * lb) < 1e-9)
        #expect(options[0].count == nil)
        #expect(abs(options[37].kg - 165 * lb) < 1e-9)

        #expect(GymDefaults.load(for: "19e5c6f170d88007ba63e3e18e4933f8") == .ranges(options: [WeightRange(minKg: 0, maxKg: 500 * lb, incrementKg: 10 * lb)]))
        #expect(GymDefaults.load(for: "19e5c6f170d880d3914cc4c2631393cd") == .base(kg: 100 * lb))
        #expect(GymDefaults.load(for: "25b5c6f170d880619592ca5ba65fc1b3")?.summary(in: .lb) == "Orange, Red, Blue, Green, Black, Purple, Red, Silver")
        #expect(GymDefaults.load(for: "19e5c6f170d880d3914cc4c2631393cd")?.summary(in: .lb) == "100\u{00A0}lb")
    }

    @Test func aGymLoadOverridesTheDefault() {
        let hackSquat = "19e5c6f170d880d3914cc4c2631393cd"
        var profile = gym(hackSquat)
        #expect(GymDefaults.effectiveLoad(hackSquat, in: profile) == .base(kg: 100 * lb))
        profile.equipment[hackSquat] = GymEquipment(load: .base(kg: 20))
        #expect(GymDefaults.effectiveLoad(hackSquat, in: profile) == .base(kg: 20))
    }
}
