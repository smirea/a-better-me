import SwiftUI

extension View {
    /// Every prominent glass button. `.glassProminent` fills with the tint and the app's tint is white, so the native
    /// style alone draws white text on a white fill; this sets the label to `Theme.onPrimary` on the white fill.
    func prominentButton(tint: Color = Theme.textPrimary) -> some View {
        buttonStyle(.glassProminent)
            .tint(tint)
            .foregroundStyle(tint == Theme.textPrimary ? Theme.onPrimary : Theme.textPrimary)
    }

    /// The app's primary action: a full-width white glass pill.
    func primaryPill() -> some View {
        prominentButton()
            .buttonSizing(.flexible)
            .controlSize(.large)
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

extension View {
    /// A small capsule action beside a row's value or a card's content: Edit, Change, Edit Icon.
    func chipButton() -> some View {
        buttonStyle(.glass).buttonBorderShape(.capsule).font(AppFont.chip)
    }
}

/// The primary pill of a screen's `pinnedActions`: Start Workout, Next, Save to Library, Save.
struct PinnedActionButton: View {
    let title: String
    let action: () -> Void

    init(_ title: String, action: @escaping () -> Void) {
        self.title = title
        self.action = action
    }

    var body: some View {
        Button(title, action: action).primaryPill()
    }
}

extension View {
    /// A screen's bottom actions, inset by the margins: secondary pills first, the primary pill last.
    func pinnedActions<Actions: View>(@ViewBuilder _ actions: () -> Actions) -> some View {
        safeAreaInset(edge: .bottom) {
            VStack(spacing: 8) { actions() }
                .padding(.horizontal, Theme.margin)
                .padding(.vertical, 8)
        }
    }
}
