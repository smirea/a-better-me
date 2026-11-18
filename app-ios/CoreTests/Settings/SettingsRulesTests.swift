import Foundation
import Testing
@testable import Core

struct SettingsRulesTests {
    @Test func energyIsStoredInKcalAndShownInTheEnergyUnit() {
        #expect(NutritionSettings.EnergyUnit.kcal.fromKcal(2000) == 2000)
        #expect(NutritionSettings.EnergyUnit.kj.fromKcal(2000) == 8368)
        #expect(NutritionSettings.EnergyUnit.kj.toKcal(8368) == 2000)
    }

    @Test func favoriteMeasuresKeepTwoPerCategory() {
        let defaults = NutritionSettings().favoriteMeasures
        #expect(SettingsRules.toggleFavorite("lb", in: defaults) == ["oz", "mL", "cup", "lb"])
        #expect(SettingsRules.toggleFavorite("tbsp", in: defaults) == ["g", "oz", "cup", "tbsp"])
        #expect(SettingsRules.toggleFavorite("oz", in: defaults) == ["g", "mL", "cup"])
        #expect(SettingsRules.toggleFavorite("lb", in: ["mL"]) == ["mL", "lb"])
    }
}

/// Every Nutrition setting is one JSON column on the settings row, so it survives a relaunch and syncs.
@MainActor
struct NutritionSettingsPersistenceTests {
    @Test func nutritionSettingsSurviveReopeningTheDatabase() async throws {
        let url = FileManager.default.temporaryDirectory.appending(path: "settings-\(UUID().uuidString)/a.sqlite")
        let store = try LocalStore(unsyncedAt: url)
        store.updateSettings { settings in
            settings.nutrition.energyUnit = .kj
            settings.nutrition.heightUnit = .centimeters
            settings.nutrition.timeline.addFoodsToHour = .longPress
            settings.nutrition.logger.optimization = .context
            settings.nutrition.expenditure.staticKcal = 2400
            settings.nutrition.expenditure.algorithm = .v2
            settings.nutrition.expenditure.activity = .veryActive
            settings.nutrition.coachingModules.weighIn = true
            settings.nutrition.hiddenNutrients = ["262"]
            settings.nutrition.visibleBodyMetrics = [.waist]
            settings.profile.heightCm = 180
        }
        try await store.write { _ in }.value

        let reopened = try LocalStore(unsyncedAt: url).readBlocking(AppSettings.current.fetch)
        var expected = NutritionSettings()
        expected.energyUnit = .kj
        expected.heightUnit = .centimeters
        expected.timeline.addFoodsToHour = .longPress
        expected.logger.optimization = .context
        expected.expenditure.staticKcal = 2400
        expected.expenditure.algorithm = .v2
        expected.expenditure.activity = .veryActive
        expected.coachingModules.weighIn = true
        expected.hiddenNutrients = ["262"]
        expected.visibleBodyMetrics = [.waist]
        #expect(reopened.nutrition == expected)
        #expect(reopened.profile.heightCm == 180)
    }
}
