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

/// A detail page's action as MacroFactor lays them out in a row: an icon in a raised circle over its title. The entry
/// editor's Remove and Duplicate and the recipe page's Prepare and Edit.
struct ActionLabel: View {
    let title: String
    let systemImage: String

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: systemImage)
                .font(.system(size: 16, weight: .semibold))
                .frame(width: 40, height: 40)
                .background(Theme.surfaceRaised, in: .circle)
            Text(title).font(AppFont.rowDetail)
        }
        .foregroundStyle(Theme.textPrimary)
        .frame(maxWidth: .infinity)
    }
}

/// The small circle at a row's trailing edge that acts on the row without opening it: add a food to the plate, add or
/// swap an exercise, take one out of a selection. It fills white while on. The hit area is the full 44 pt.
struct RowActionButton: View {
    let title: String
    let systemImage: String
    var isOn = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(isOn ? Theme.onPrimary : Theme.textPrimary)
                .contentTransition(.symbolEffect(.replace))
                .frame(width: 28, height: 28)
                .background(isOn ? Theme.textPrimary : Theme.surfaceRaised, in: .circle)
                .frame(width: 44, height: 44)
                .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}
