import SwiftUI

extension FoodLogState {
    /// Untyped, so screens pushed here push their own routes too: Strategy, from a day without a plan, pushes `StrategyRoute`.
    var path: NavigationPath {
        get { navigationPath as? NavigationPath ?? NavigationPath() }
        set { navigationPath = newValue }
    }
}
