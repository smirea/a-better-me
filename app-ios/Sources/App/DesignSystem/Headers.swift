import SwiftUI

/// A screen section's title with its trailing text actions (See All, Collapse, a cycle picker), drawn alike on every
/// tab.
struct SectionHeader<Actions: View>: View {
    let title: String
    @ViewBuilder let actions: Actions

    init(_ title: String, @ViewBuilder actions: () -> Actions) {
        self.title = title
        self.actions = actions()
    }

    var body: some View {
        HStack(spacing: 12) {
            Text(title).font(AppFont.sectionTitle)
            Spacer()
            actions
                .font(AppFont.medium(15))
                .underline()
                .foregroundStyle(Theme.textPrimary)
        }
    }
}

extension SectionHeader where Actions == EmptyView {
    init(_ title: String) {
        self.init(title) { EmptyView() }
    }
}

/// The header's "See All", pushing `value` on the enclosing stack.
struct SeeAllLink<Value: Hashable>: View {
    let section: String
    let value: Value

    var body: some View {
        NavigationLink("See All", value: value)
            .accessibilityLabel("See All \(section)")
    }
}

/// A list section's title, smaller than a screen section's.
struct SectionTitle: View {
    let title: String

    init(_ title: String) { self.title = title }

    var body: some View {
        Text(title).font(AppFont.listTitle).foregroundStyle(Theme.textPrimary)
    }
}
