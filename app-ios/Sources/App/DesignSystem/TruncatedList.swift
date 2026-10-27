import SwiftUI

/// A section for a list that grows with use (weigh-ins, entries, past sessions). The card shows five and a half rows,
/// the half row fading out so the list reads as continuing, and the header's See All pushes `destination` with every
/// row. Six rows or fewer show whole and get no link.
struct TruncatedList<Item: Identifiable, Row: View, Destination: View>: View {
    static var visibleRows: Double { 5.5 }

    let title: String
    let items: [Item]
    @ViewBuilder let row: (Item) -> Row
    @ViewBuilder let destination: () -> Destination

    init(_ title: String, items: [Item], @ViewBuilder row: @escaping (Item) -> Row, @ViewBuilder destination: @escaping () -> Destination) {
        self.title = title
        self.items = items
        self.row = row
        self.destination = destination
    }

    var body: some View {
        let shown = Int(Self.visibleRows.rounded(.up))
        let truncated = items.count > shown
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title) {
                if truncated {
                    NavigationLink("See All \(items.count)", destination: destination)
                        .accessibilityLabel("See All \(title)")
                }
            }
            PeekStack(visibleRows: truncated ? Self.visibleRows : nil) {
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
            .background(Theme.surface, in: .rect(cornerRadius: Theme.cornerRadius))
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
