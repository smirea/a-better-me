import Feedback
import SwiftUI

/// A section for a list that grows with use (weigh-ins, entries, past sessions). Draws flat on `Theme.background` with
/// an optional top hairline divider by default, showing five and a half rows with the half row fading out so the list
/// reads as continuing, and the header's See All pushes `destination` with every row. Six rows or fewer show whole and
/// get no link. Pass `inList: true` inside a grouped `Form` or `List` to keep the card surface aligned with sibling
/// `ThemedSection`s.
struct TruncatedList<Item: Identifiable, Row: View, Destination: View>: View {
    static var visibleRows: Double { 5.5 }

    let title: String
    let items: [Item]
    @ViewBuilder let row: (Item) -> Row
    @ViewBuilder let destination: () -> Destination
    /// Set inside a `Form` or `List`, where the section is one clear cell: the title takes a list section's size and
    /// inset, so it lines up with the `ThemedSection`s around it and clears the cell's rounded corner.
    private let inList: Bool
    private let divider: Bool
    /// Feedback names the call site, since this file says nothing about which list it is.
    private let source: (file: String, line: Int)

    init(
        _ title: String, items: [Item], inList: Bool = false, divider: Bool = true, @ViewBuilder row: @escaping (Item) -> Row,
        @ViewBuilder destination: @escaping () -> Destination, file: String = #fileID, line: Int = #line
    ) {
        self.inList = inList
        self.divider = divider
        self.title = title
        self.items = items
        self.row = row
        self.destination = destination
        source = (file, line)
    }

    var body: some View {
        let shown = Int(Self.visibleRows.rounded(.up))
        let truncated = items.count > shown
        let list = PeekStack(visibleRows: truncated ? Self.visibleRows : nil) {
            ForEach(Array(items.prefix(shown).enumerated()), id: \.element.id) { index, item in
                row(item).overlay(alignment: .top) {
                    if index > 0 { Divider().overlay(Theme.separator) }
                }
            }
        }
        .clipped()
        .mask {
            LinearGradient(stops: [.init(color: .black, location: truncated ? 0.82 : 1), .init(color: .black.opacity(truncated ? 0.1 : 1), location: 1)], startPoint: .top, endPoint: .bottom)
        }
        VStack(alignment: .leading, spacing: 10) {
            if inList {
                HStack(spacing: 12) {
                    SectionTitle(title)
                    Spacer()
                    seeAll(truncated).font(AppFont.rowTitle).underline().foregroundStyle(Theme.textPrimary)
                }
                .padding(.horizontal, 16)
                list.background(Theme.surface, in: .rect(cornerRadius: Theme.cornerRadius))
            } else {
                if divider {
                    Divider().overlay(Theme.separator)
                }
                SectionHeader(title) { seeAll(truncated) }
                list
            }
        }
        .feedback(title, data: "\(items.count) rows", file: source.file, line: source.line)
    }

    @ViewBuilder
    private func seeAll(_ truncated: Bool) -> some View {
        if truncated {
            NavigationLink("See All \(items.count)", destination: destination)
                .accessibilityLabel("See All \(title)")
        }
    }
}

/// Stacks rows at their ideal height and reports the height of the first `visibleRows`, cutting the last one partway.
private struct PeekStack: Layout {
    var visibleRows: Double?

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let heights = heights(subviews, width: proposal.width)
        let width = proposal.width ?? subviews.map { $0.sizeThatFits(.unspecified).width }.max() ?? 0
        guard let visibleRows else { return CGSize(width: width, height: heights.reduce(0, +)) }
        let whole = Int(visibleRows)
        let partial = whole < heights.count ? heights[whole] * (visibleRows - Double(whole)) : 0
        return CGSize(width: width, height: heights.prefix(whole).reduce(0, +) + partial)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for (subview, height) in zip(subviews, heights(subviews, width: bounds.width)) {
            subview.place(at: CGPoint(x: bounds.minX, y: y), proposal: ProposedViewSize(width: bounds.width, height: height))
            y += height
        }
    }

    private func heights(_ subviews: Subviews, width: CGFloat?) -> [CGFloat] {
        subviews.map { $0.sizeThatFits(ProposedViewSize(width: width, height: nil)).height }
    }
}
