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
    /// Where a logging action opens the logger, as the Nutrition "+" shortcut of the same name does.
    var logger: LoggerStart? {
        switch self {
        case .search: NutritionShortcut.search.logger
        case .barcode: NutritionShortcut.barcode.logger
        case .quickAdd: NutritionShortcut.quickAdd.logger
        case .ramble: NutritionShortcut.ramble.logger
        case .foods: NutritionShortcut.yourFoods.logger
        case .recipes: NutritionShortcut.recipes.logger
        case .favorites: NutritionShortcut.favorites.logger
        case .weight, .foodLog, .dashboard, .newWorkout, .emptyWorkout: nil
        }
    }
}
