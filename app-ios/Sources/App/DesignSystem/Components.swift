import SwiftUI
import UIKit

extension View {
    /// The reference app's wide all-caps tab titles, drawn by the native navigation bar.
    func screenTitle(_ title: String) -> some View {
        navigationTitle(title.uppercased()).navigationBarTitleDisplayMode(.large)
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

/// Placeholder root for a tab whose feature thread has not landed yet.
struct ComingSoon: View {
    let title: String

    var body: some View {
        NavigationStack {
            ContentUnavailableView("Not built yet", systemImage: "hammer")
                .screenTitle(title)
        }
    }
}
