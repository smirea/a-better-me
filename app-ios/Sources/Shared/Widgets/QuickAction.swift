import Foundation

/// A screen a Quick Actions widget or the Control Center control opens: MacroFactor's quick action targets, with Ramble
/// in AI's place, plus the Workouts half's "+" and an empty workout.
enum QuickAction: String, CaseIterable, Codable, Sendable {
    case search, barcode, quickAdd, ramble, foods, recipes, favorites, weight, foodLog, dashboard, newWorkout, emptyWorkout

    var title: String {
        switch self {
        case .search: "Search"
        case .barcode: "Barcode"
        case .quickAdd: "Quick Add"
        case .ramble: "Ramble"
        case .foods: "Your Foods"
        case .recipes: "Recipes"
        case .favorites: "Favorites"
        case .weight: "Weight"
        case .foodLog: "Food Log"
        case .dashboard: "Dashboard"
        case .newWorkout: "New Workout"
        case .emptyWorkout: "Empty Workout"
        }
    }

    var systemImage: String {
        switch self {
        case .search: "magnifyingglass"
        case .barcode: "barcode.viewfinder"
        case .quickAdd: "bolt.fill"
        case .ramble: "waveform"
        case .foods: "fork.knife"
        case .recipes: "frying.pan"
        case .favorites: "heart.fill"
        case .weight: "scalemass.fill"
        case .foodLog: "list.bullet.rectangle"
        case .dashboard: "square.grid.2x2"
        case .newWorkout: "plus"
        case .emptyWorkout: "dumbbell.fill"
        }
    }

    private static let host = "action"

    /// `abetterme://action/<case>`, which the app's `onOpenURL` routes.
    var url: URL { URL(string: "abetterme://\(Self.host)/\(rawValue)")! }

    init?(url: URL) {
        guard url.scheme == "abetterme", url.host() == Self.host, let action = QuickAction(rawValue: url.lastPathComponent) else {
            return nil
        }
        self = action
    }
}

#if os(iOS)
import AppIntents

extension QuickAction: AppEnum {
    // App Intents metadata extraction reads these as literals, so they repeat `title` and `systemImage`.
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Quick Action"

    static let caseDisplayRepresentations: [QuickAction: DisplayRepresentation] = [
        .search: DisplayRepresentation(title: "Search", image: .init(systemName: "magnifyingglass")),
        .barcode: DisplayRepresentation(title: "Barcode", image: .init(systemName: "barcode.viewfinder")),
        .quickAdd: DisplayRepresentation(title: "Quick Add", image: .init(systemName: "bolt.fill")),
        .ramble: DisplayRepresentation(title: "Ramble", image: .init(systemName: "waveform")),
        .foods: DisplayRepresentation(title: "Your Foods", image: .init(systemName: "fork.knife")),
        .recipes: DisplayRepresentation(title: "Recipes", image: .init(systemName: "frying.pan")),
        .favorites: DisplayRepresentation(title: "Favorites", image: .init(systemName: "heart.fill")),
        .weight: DisplayRepresentation(title: "Weight", image: .init(systemName: "scalemass.fill")),
        .foodLog: DisplayRepresentation(title: "Food Log", image: .init(systemName: "list.bullet.rectangle")),
        .dashboard: DisplayRepresentation(title: "Dashboard", image: .init(systemName: "square.grid.2x2")),
        .newWorkout: DisplayRepresentation(title: "New Workout", image: .init(systemName: "plus")),
        .emptyWorkout: DisplayRepresentation(title: "Empty Workout", image: .init(systemName: "dumbbell.fill")),
    ]
}

/// Opens the app on a quick action's screen. It runs in the app's process, which installs `handler` at launch, so the
/// widget buttons and the control share the app's routing with `abetterme://action/` links.
struct OpenQuickActionIntent: AppIntent {
    static let title: LocalizedStringResource = "Open Quick Action"
    static let supportedModes: IntentModes = .foreground(.immediate)

    @MainActor static var handler: ((QuickAction) -> Void)?

    @Parameter(title: "Action", default: .search) var action: QuickAction

    init() {}

    init(_ action: QuickAction) {
        self.action = action
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        guard let handler = Self.handler else { throw Failure.notInstalled }
        handler(action)
        return .result()
    }

    enum Failure: Error {
        case notInstalled
    }
}
#endif
