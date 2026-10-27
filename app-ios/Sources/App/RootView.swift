import HealthKitUI
import SwiftUI

enum AppTab: Hashable {
    case dashboard, nutrition, workout, more, add
}

/// What "+" opens: the selected tab's sheet, or a choice between them where no tab owns one.
enum AddSheet: Identifiable {
    case food, workout, choose

    var id: Self { self }

    init(for tab: AppTab) {
        self = switch tab {
        case .nutrition: .food
        case .workout: .workout
        case .dashboard, .more, .add: .choose
        }
    }
}

struct RootView: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(LiveWorkoutPresenter.self) private var presenter
    @Environment(LocalStore.self) private var store
    @Observe(CustomExercise.all) private var customExercises
    @Observe(WorkoutSession.inProgressID) private var activeSessionID
    @Observe(BodyWeight.all) private var loggedWeights
    @State private var health = HealthData()
    @State private var tab = AppTab.dashboard
    @State private var adding: AddSheet?

    var body: some View {
        TabView(selection: $tab) {
            // The tab bar's selection keeps the accent, so each tab's content restores the app's white tint.
            Tab("Dashboard", systemImage: "square.grid.2x2", value: .dashboard) { DashboardTab().tint(Theme.textPrimary) }
            Tab("Nutrition", systemImage: "fork.knife", value: .nutrition) { FoodLogTab().tint(Theme.textPrimary) }
            Tab("Workout", systemImage: "dumbbell", value: .workout) { WorkoutTab().tint(Theme.textPrimary) }
            Tab("More", systemImage: "ellipsis", value: .more) { MoreTab().tint(Theme.textPrimary) }
            Tab("New", systemImage: "plus", value: .add, role: .prominent) { Color.clear }
        }
        .tint(Theme.accent)
        .tabViewBottomAccessory(isEnabled: activeSessionID != nil) { ActiveSessionBar() }
        .resolvingWorkoutStart()
        .onChange(of: tab) { previous, current in
            // "+" acts like a button: it opens the previous tab's sheet and keeps that tab selected.
            guard current == .add else { return }
            adding = AddSheet(for: previous)
            tab = previous
        }
        .sheet(item: $adding) { AddSheetView(sheet: $0) }
        // A session's insert and the observation that shows it land a moment apart, so the cover waits for both.
        .fullScreenCover(isPresented: Binding(get: { presenter.isExpanded && activeSessionID != nil }, set: { presenter.isExpanded = $0 })) {
            LiveWorkoutView()
        }
        .onChange(of: customExercises.map(\.exercise), initial: true) { _, exercises in
            catalog.setCustom(exercises)
        }
        .onChange(of: loggedWeights, initial: true) { health.update(logged: loggedWeights) }
        .healthDataAccessRequest(store: health.store, shareTypes: HealthData.shareTypes, readTypes: HealthData.readTypes, trigger: health.requestTrigger) { _ in
            Task { await health.load() }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await health.refresh() } }
        }
        .task { await health.refresh() }
        .task { await GymSeed.run(store, equipment: catalog.equipment) }
        .onOpenURL { url in
            if url == LiveActivityLink.liveWorkout { presenter.isExpanded = true }
        }
        .environment(health)
    }
}

/// "+" from Dashboard or More asks which half to add to, then becomes that half's sheet in place.
private struct AddSheetView: View {
    @State var sheet: AddSheet

    var body: some View {
        switch sheet {
        case .food: NutritionAddSheet()
        case .workout: NewWorkoutSheet()
        case .choose:
            VStack(spacing: 12) {
                Text("Add").font(AppFont.headline())
                HStack(spacing: 12) {
                    choice("Log Food", systemImage: "fork.knife") { sheet = .food }
                    choice("Workout", systemImage: "dumbbell") { sheet = .workout }
                }
            }
            .padding(20)
            .presentationDetents([.height(190)])
        }
    }

    private func choice(_ title: String, systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: systemImage).font(.title2).frame(height: 28)
                Text(title).font(AppFont.headline(15))
            }
            .frame(maxWidth: .infinity, minHeight: 96)
        }
        .buttonStyle(.glass)
        .buttonBorderShape(.roundedRectangle(radius: Theme.cornerRadius))
    }
}
