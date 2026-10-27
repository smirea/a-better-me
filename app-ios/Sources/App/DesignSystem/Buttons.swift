import SwiftUI

extension View {
    /// The app's primary action: a full-width white glass pill.
    func primaryPill() -> some View {
        buttonStyle(.glassProminent)
            .buttonSizing(.flexible)
            .controlSize(.large)
            .tint(Theme.textPrimary)
            .foregroundStyle(Theme.background)
            .font(AppFont.headline())
    }

    func secondaryPill() -> some View {
        buttonStyle(.glass)
            .buttonSizing(.flexible)
            .controlSize(.large)
            .foregroundStyle(Theme.textPrimary)
            .font(AppFont.headline())
    }
}

/// The primary pill pinned to the bottom of a screen: Start Workout, Next, Save to Library, Save.
struct PinnedActionButton: View {
    let title: String
    let action: () -> Void

    init(_ title: String, action: @escaping () -> Void) {
        self.title = title
        self.action = action
    }

    var body: some View {
        Button(title, action: action)
            .primaryPill()
            .padding(.horizontal, 20)
            .padding(.bottom, 8)
    }
}
