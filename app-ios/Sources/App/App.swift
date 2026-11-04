import Feetback
import SwiftUI

@main
struct BetterMeApp: App {
    @State private var catalog: ExerciseCatalog
    @State private var presenter: LiveWorkoutPresenter
    @State private var store: LocalStore
    @State private var history: SessionHistory

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
        LiveWorkoutController.shared.start(store: store, history: history, catalog: catalog)
        WorkoutActivityController.shared.start(store: store, catalog: catalog)
        WatchBridge.shared.start(store: store, history: history, catalog: catalog)
        WorkoutHealth.shared.start(store: store, catalog: catalog)
        NutritionHealth.shared.start(store: store)
        WidgetPublisher.shared.start(store: store)
        QuickActionInbox.shared.install()
        Feetback.enable()
        Feetback.context("Sync") { (api: AppEnvironment.apiURL.absoluteString, pendingWrites: store.pendingWrites) }
        Feetback.context("Workout") {
            (inProgressShown: presenter.isExpanded, finishedSessions: history.sessions.count, customExercises: catalog.custom.count)
        }
        Feetback.context("Assets") { AssetStore.shared.statusLine }
        #if DEBUG
        DevSeed.run(store)
        SampleData.seedIfRequested(store)
        store.seedGeneratedProgramIfRequested(catalog: catalog)
        SampleWorkout.startIfRequested(store)
        #endif
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(catalog)
                .environment(presenter)
                .environment(store)
                .environment(history)
                .font(AppFont.body())
                .preferredColorScheme(.dark)
                .tint(Theme.textPrimary)
        }
    }
}
