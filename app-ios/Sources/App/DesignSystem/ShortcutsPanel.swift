import SwiftUI

protocol ShortcutItem: Hashable {
    var title: String { get }
    var systemImage: String { get }
}

/// The body of both "+" sheets: round shortcuts on top, an optional banner, and the rest as rows. It reports its height
/// so the sheet can fit it with `.shortcutsFitted`.
struct ShortcutsPanel<Item: ShortcutItem, Banner: View>: View {
    let top: [Item]
    let rows: [Item]
    @Binding var height: CGFloat
    let perform: (Item) -> Void
    let customize: () -> Void
    @ViewBuilder var banner: Banner

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if !top.isEmpty {
                    HStack(alignment: .top) {
                        ForEach(top, id: \.self) { round($0) }
                    }
                    .padding(.top, 8)
                }
                banner
                VStack(spacing: 0) {
                    ForEach(rows, id: \.self) { item in
                        if item != rows.first { Divider().overlay(Theme.separator).padding(.leading, 44) }
                        row(item)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 8)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height = $0 }
        }
        .scrollBounceBehavior(.basedOnSize)
        .background(Theme.surface)
        .detailTitle("Shortcuts")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button(role: .close) { dismiss() }
            }
            ToolbarItem(placement: .primaryAction) {
                Button("Customize Shortcuts", systemImage: "slider.horizontal.3", action: customize)
            }
        }
    }

    private func round(_ item: Item) -> some View {
        Button { perform(item) } label: {
            VStack(spacing: 8) {
                Image(systemName: item.systemImage)
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 44, height: 44)
                    .background(Theme.surfaceRaised, in: .circle)
                Text(item.title).font(AppFont.medium(13))
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func row(_ item: Item) -> some View {
        Button { perform(item) } label: {
            HStack(spacing: 18) {
                Image(systemName: item.systemImage).frame(width: 26)
                Text(item.title).font(AppFont.headline())
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary)
            }
            .padding(.vertical, 16)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

extension ShortcutsPanel where Banner == EmptyView {
    init(top: [Item], rows: [Item], height: Binding<CGFloat>, perform: @escaping (Item) -> Void, customize: @escaping () -> Void) {
        self.init(top: top, rows: rows, height: height, perform: perform, customize: customize) { EmptyView() }
    }
}

extension PresentationDetent {
    /// A shortcuts sheet sized to its panel: the measured content plus the inline navigation bar and grabber.
    static func shortcutsFitted(_ height: CGFloat) -> PresentationDetent { .height(height + 76) }
}
