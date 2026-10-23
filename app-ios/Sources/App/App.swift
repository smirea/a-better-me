import SwiftData
import SwiftUI

@main
struct BetterMeApp: App {
    @State private var catalog: ExerciseCatalog
    private let container: ModelContainer

    init() {
        AppFont.register()
        NavigationAppearance.apply()
        _catalog = State(initialValue: ExerciseCatalog())
        container = Self.makeContainer()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(catalog)
                .font(AppFont.body())
                .preferredColorScheme(.dark)
                .tint(Theme.accent)
        }
        .modelContainer(container)
    }

    /// While the schema is young a store that no longer opens is wiped instead of migrated (see docs/decisions/ios.md).
    private static func makeContainer() -> ModelContainer {
        let schema = Schema(WorkoutSchema.models)
        let config = ModelConfiguration(schema: schema)
        if let container = try? ModelContainer(for: schema, configurations: config) { return container }
        try? FileManager.default.removeItem(at: config.url)
        do {
            return try ModelContainer(for: schema, configurations: config)
        } catch {
            fatalError("Cannot open the SwiftData store: \(error)")
        }
    }
}
