import Feedback
import SwiftUI

@main
struct BetterMeApp: App {
    @State private var catalog: ExerciseCatalog
    @State private var presenter: LiveWorkoutPresenter
    @State private var store: LocalStore
    @State private var history: SessionHistory
    @State private var health: HealthData

    init() {
        Telemetry.start()
        AppFont.register()
        NavigationAppearance.apply()
        AssetStore.shared.start()
        _ = NutrientRegistry.all
        let catalog = ExerciseCatalog()
        let presenter = LiveWorkoutPresenter()
        _presenter = State(initialValue: presenter)
        _catalog = State(initialValue: catalog)
        let store = LocalStore()
        _store = State(initialValue: store)
        let history = SessionHistory(store: store)
        _history = State(initialValue: history)
        let health = HealthData(store: store)
        _health = State(initialValue: health)
        catalog.observeCustom(in: store)
        LiveWorkoutController.shared.start(store: store, history: history, catalog: catalog)
        WorkoutActivityController.shared.start(store: store, catalog: catalog)
        WatchBridge.shared.start(store: store, history: history, catalog: catalog)
        WorkoutHealth.shared.start(store: store, catalog: catalog)
        NutritionHealth.shared.start(store: store)
        WidgetPublisher.shared.start(store: store, health: health)
        QuickActionInbox.shared.install()
        Feedback.enable()
        Feedback.context("Sync") {
            let position = store.syncPosition
            return (
                api: AppEnvironment.apiURL.absoluteString, pendingWrites: store.pendingWrites, cursor: position.cursor,
                space: position.space
            )
        }
        Feedback.context("Workout") {
            (inProgressShown: presenter.isExpanded, finishedSessions: history.sessions.count, customExercises: catalog.custom.count)
        }
        Feedback.context("Assets") { AssetStore.shared.statusLine }
        #if DEBUG
        DevSeed.run(store)
        #endif
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(catalog)
                .environment(presenter)
                .environment(store)
                .environment(history)
                .environment(health)
                .font(AppFont.body())
                .preferredColorScheme(.dark)
                .tint(Theme.textPrimary)
        }
    }
}
