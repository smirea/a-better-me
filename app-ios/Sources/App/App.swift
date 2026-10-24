import SwiftUI

@main
struct BetterMeApp: App {
    @State private var catalog: ExerciseCatalog
    @State private var presenter = LiveWorkoutPresenter()
    @State private var store: LocalStore
    @Environment(\.scenePhase) private var scenePhase

    init() {
        AppFont.register()
        NavigationAppearance.apply()
        _catalog = State(initialValue: ExerciseCatalog())
        #if DEBUG
        OwnerToken.applyLaunchArgument()
        #endif
        let store = LocalStore()
        _store = State(initialValue: store)
        #if DEBUG
        SampleData.seedIfRequested(store)
        store.seedGeneratedProgramIfRequested(catalog: _catalog.wrappedValue)
        SampleWorkout.startIfRequested(store)
        #endif
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if store.isReady {
                    RootView()
                } else {
                    Theme.background.ignoresSafeArea()
                }
            }
            .environment(catalog)
            .environment(presenter)
            .environment(store)
            .font(AppFont.body())
            .preferredColorScheme(.dark)
            .tint(Theme.accent)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { store.resume() }
        }
    }
}
