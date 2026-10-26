/// Which app the tab bar shows: MacroFactor Workouts or MacroFactor. It is the device's UI state, so it lives in
/// `@AppStorage` and never syncs.
enum AppMode: String {
    case workouts, nutrition

    var other: AppMode {
        switch self {
        case .workouts: .nutrition
        case .nutrition: .workouts
        }
    }

    var title: String {
        switch self {
        case .workouts: "Workouts"
        case .nutrition: "Nutrition"
        }
    }

    var systemImage: String {
        switch self {
        case .workouts: "dumbbell"
        case .nutrition: "fork.knife"
        }
    }
}
