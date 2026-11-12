import Observation

/// The quick action a widget, the control, or an `abetterme://action/` link asked for, until `RootView` opens it. The
/// intent can run before the first frame on a cold launch, so it lands here instead of in view state.
@MainActor @Observable
final class QuickActionInbox {
    static let shared = QuickActionInbox()

    var pending: QuickAction?

    func install() {
        OpenQuickActionIntent.handler = { [weak self] in self?.pending = $0 }
    }
}

extension QuickAction {
    /// Where a logging action opens the logger.
    var logger: LoggerStart? {
        switch self {
        case .search: LoggerStart(tab: .search)
        case .barcode: LoggerStart(tab: .scan)
        case .quickAdd: LoggerStart(tab: .quickAdd)
        case .ramble: LoggerStart(tab: .ramble)
        case .foods: LoggerStart(tab: .library, library: .foods)
        case .recipes: LoggerStart(tab: .library, library: .recipes)
        case .favorites: LoggerStart(tab: .library, library: .favorites)
        case .weight, .foodLog, .dashboard, .steps, .newWorkout, .emptyWorkout: nil
        }
    }
}
