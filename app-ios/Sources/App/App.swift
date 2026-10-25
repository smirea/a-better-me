import SwiftUI

@main
struct BetterMeApp: App {
    @State private var catalog: ExerciseCatalog
    @State private var presenter = LiveWorkoutPresenter()
    @State private var store: LocalStore

    init() {
        AppFont.register()
        NavigationAppearance.apply()
        let catalog = ExerciseCatalog()
        _catalog = State(initialValue: catalog)
        let store = LocalStore()
        _store = State(initialValue: store)
        LiveWorkoutController.shared.start(store: store, catalog: catalog)
        WorkoutActivityController.shared.start(store: store, catalog: catalog)
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
                .font(AppFont.body())
                .preferredColorScheme(.dark)
                .tint(Theme.textPrimary)
        }
    }
}
