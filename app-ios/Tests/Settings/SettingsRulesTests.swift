import Foundation
import Testing
@testable import App

struct SettingsRulesTests {
    @Test func energyIsStoredInKcalAndShownInTheEnergyUnit() {
        #expect(SettingsRules.displayEnergy(2000, in: .kcal) == 2000)
        #expect(SettingsRules.displayEnergy(2000, in: .kj) == 8368)
        #expect(SettingsRules.storedEnergy(8368, in: .kj) == 2000)
    }

    @Test func heightsReadInFeetAndInchesOrCentimeters() {
        #expect(SettingsRules.height(180, in: .feetAndInches) == "5' 11\"")
        #expect(SettingsRules.height(180, in: .centimeters) == "180 cm")
        #expect(SettingsRules.height(182.88, in: .feetAndInches) == "6' 0\"")
        let inches = SettingsRules.heightChoices(in: .feetAndInches)
        #expect((inches.first, inches.last, inches.count) == (121.92, 228.6, 43))
        #expect(inches.map { SettingsRules.height($0, in: .feetAndInches) }.prefix(2) == ["4' 0\"", "4' 1\""])
    }

    @Test func hoursReadOnATwelveHourClock() {
        #expect([0, 8, 12, 21].map(SettingsRules.hour) == ["12 AM", "8 AM", "12 PM", "9 PM"])
    }

    @Test func favoriteMeasuresKeepTwoPerCategory() {
        let defaults = NutritionSettings().favoriteMeasures
        #expect(defaults == ["g", "oz", "mL", "cup"])
        #expect(SettingsRules.toggleFavorite("lb", in: defaults) == ["oz", "mL", "cup", "lb"])
        #expect(SettingsRules.toggleFavorite("tbsp", in: defaults) == ["g", "oz", "cup", "tbsp"])
        #expect(SettingsRules.toggleFavorite("oz", in: defaults) == ["g", "mL", "cup"])
        #expect(SettingsRules.toggleFavorite("lb", in: ["mL"]) == ["mL", "lb"])
    }

    @Test func bodyMetricTitlesSplitTheirWords() {
        #expect([BodyMetricKind.leftBicep, .neck, .rightAnkle].map(\.title) == ["Left Bicep", "Neck", "Right Ankle"])
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

        let reopened = try LocalStore(unsyncedAt: url).read(AppSettings.current.fetch)
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
