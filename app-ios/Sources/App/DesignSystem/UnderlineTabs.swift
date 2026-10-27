import SwiftUI

/// A scrolling row of text tabs with a sliding underline under the selected one. `trailing` adds actions drawn as
/// unselected tabs at the end, such as Add Day.
struct UnderlineTabs<ID: Hashable, Trailing: View>: View {
    let items: [(id: ID, title: String)]
    @Binding var selection: ID
    @ViewBuilder var trailing: Trailing

    @Namespace private var underline

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal) {
                HStack(spacing: 22) {
                    ForEach(items, id: \.id) { item in
                        tab(item.title, isSelected: item.id == selection) {
                            withAnimation(.snappy) { selection = item.id }
                        }
                        .id(item.id)
                    }
                    trailing
                        .font(AppFont.rowTitle)
                        .foregroundStyle(Theme.textSecondary)
                        .padding(.vertical, 10)
                        .buttonStyle(.plain)
                }
                .padding(.horizontal, Theme.margin)
            }
            .scrollIndicators(.hidden)
            .overlay(alignment: .bottom) { Rectangle().fill(Theme.separator).frame(height: 1) }
            .onChange(of: selection) { _, id in
                withAnimation { proxy.scrollTo(id, anchor: .center) }
            }
            .onAppear { proxy.scrollTo(selection, anchor: .center) }
        }
    }

    private func tab(_ title: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(AppFont.rowTitle)
                .foregroundStyle(isSelected ? Theme.textPrimary : Theme.textSecondary)
                .padding(.vertical, 10)
                .overlay(alignment: .bottom) {
                    if isSelected {
                        Capsule()
                            .fill(Theme.textPrimary)
                            .frame(height: 3)
                            .matchedGeometryEffect(id: "underline", in: underline)
                    }
                }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

extension UnderlineTabs where Trailing == EmptyView {
    init(items: [(id: ID, title: String)], selection: Binding<ID>) {
        self.init(items: items, selection: selection) { EmptyView() }
    }
}
