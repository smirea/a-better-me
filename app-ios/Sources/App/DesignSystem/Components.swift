import SwiftUI
import UIKit

extension View {
    /// A tab root's title, large and leading on the same row as its toolbar buttons.
    func screenTitle(_ title: String) -> some View {
        navigationTitle(title).toolbarTitleDisplayMode(.inlineLarge)
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

    /// Asks for a name, as creating or renaming a section, program, or gym does. Blank names are ignored.
    func nameAlert(_ title: String, isPresented: Binding<Bool>, initial: String = "", placeholder: String = "Name", confirm: String = "Save", onSave: @escaping (String) -> Void) -> some View {
        modifier(NameAlert(title: title, isPresented: isPresented, initial: initial, placeholder: placeholder, confirm: confirm, onSave: onSave))
    }
}

enum NavigationAppearance {
    /// Native bars keep Liquid Glass. Only their title fonts change to the app's.
    static func apply() {
        let bar = UINavigationBar.appearance()
        bar.largeTitleTextAttributes = [.font: UIFont(name: "DMSans-Bold", size: 30)!]
        bar.titleTextAttributes = [.font: UIFont(name: "DMSans-SemiBold", size: 17)!]
    }
}
