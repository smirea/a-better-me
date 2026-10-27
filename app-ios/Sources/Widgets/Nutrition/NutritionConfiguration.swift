import AppIntents
import WidgetKit

/// A nutrient a widget can track: the ones the app's snapshot lists, which leaves out the nutrients the owner hid.
struct NutrientEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Nutrient"
    static let defaultQuery = NutrientQuery()

    let id: String
    let name: String

    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }

    /// Calories and the macros, for a widget configured before the app first wrote a snapshot.
    fileprivate static let fallback = [
        NutrientEntity(id: "k", name: "Calories"), NutrientEntity(id: "p", name: "Protein"),
        NutrientEntity(id: "f", name: "Fat"), NutrientEntity(id: "c", name: "Carbs"),
    ]
}

/// No `defaultResult`: App Intents would fill every empty slot with it, so a new Nutrient Collection showed one
/// nutrient four times. Empty slots resolve to the pinned nutrients instead.
struct NutrientQuery: EntityQuery {
    private var all: [NutrientEntity] {
        NutritionSnapshot.load()?.nutrients.map { NutrientEntity(id: $0.id, name: $0.name) } ?? NutrientEntity.fallback
    }

    func entities(for identifiers: [String]) async throws -> [NutrientEntity] {
        all.filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [NutrientEntity] { all }
}

struct NutrientFocusConfiguration: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Nutrient Focus"
    static let description = IntentDescription("Track your progress towards your macro or micronutrient targets.")

    @Parameter(title: "Nutrient") var nutrient: NutrientEntity?
}

/// MacroFactor's four nutrient slots. An empty slot takes the pinned nutrient in its place, so a new widget shows the
/// Dashboard's calories and macros.
struct NutrientCollectionConfiguration: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Nutrient Collection"
    static let description = IntentDescription("Track multiple nutrients at once.")

    @Parameter(title: "First Nutrient") var first: NutrientEntity?
    @Parameter(title: "Second Nutrient") var second: NutrientEntity?
    @Parameter(title: "Third Nutrient") var third: NutrientEntity?
    @Parameter(title: "Fourth Nutrient") var fourth: NutrientEntity?

    var picks: [String?] { [first?.id, second?.id, third?.id, fourth?.id] }
}
