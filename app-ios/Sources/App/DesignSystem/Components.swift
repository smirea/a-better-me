import SwiftUI
import UIKit

extension View {
    /// The reference app's wide all-caps tab titles, drawn by the native navigation bar.
    func screenTitle(_ title: String) -> some View {
        navigationTitle(title.uppercased()).navigationBarTitleDisplayMode(.large)
    }

    /// A pushed screen's or sheet's title, inline.
    func detailTitle(_ title: String) -> some View {
        navigationTitle(title).navigationBarTitleDisplayMode(.inline)
    }

    /// The app's card: content on the raised surface with the large radius.
    func card() -> some View {
        padding(14).background(Theme.surface, in: .rect(cornerRadius: Theme.cornerRadius))
    }

    /// Lists and forms draw on the app background instead of the system's black grouped background.
    func themedList() -> some View {
        scrollContentBackground(.hidden).background(Theme.background)
    }
}

enum NavigationAppearance {
    /// Native bars keep Liquid Glass. Only their title fonts change to match the reference app.
    static func apply() {
        let bar = UINavigationBar.appearance()
        bar.largeTitleTextAttributes = [.font: UIFont(name: AppFont.displayName, size: 28)!]
        bar.titleTextAttributes = [.font: UIFont(name: "DMSans-SemiBold", size: 17)!]
    }
}

extension Theme {
    static func macro(_ id: NutrientID) -> Color {
        switch id {
        case .protein: protein
        case .fat: fat
        case .carbs: carbs
        default: calories
        }
    }
}
