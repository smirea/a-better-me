import SwiftUI

@main
struct BetterMeApp: App {
    @State private var catalog: ExerciseCatalog
    @State private var presenter = LiveWorkoutPresenter()
    @State private var store: LocalStore
    @State private var history: SessionHistory

    init() {
        Telemetry.start()
        AppFont.register()
        NavigationAppearance.apply()
        AssetStore.shared.start()
        let catalog = ExerciseCatalog()
        _catalog = State(initialValue: catalog)
        let store = LocalStore()
        _store = State(initialValue: store)
        let history = SessionHistory(store: store)
        _history = State(initialValue: history)
        LiveWorkoutController.shared.start(store: store, history: history, catalog: catalog)
        WorkoutActivityController.shared.start(store: store, catalog: catalog)
        WatchBridge.shared.start(store: store, history: history, catalog: catalog)
        WorkoutHealth.shared.start(store: store, catalog: catalog)
        #if DEBUG
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
