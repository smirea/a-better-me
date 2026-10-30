import Charts
import SwiftUI
import UIKit

/// What a scrubbed chart shows for the selected point: a date or slot title over one line per series.
struct ChartCallout {
    struct Line {
        var label: String?
        var value: String
        var color: Color
    }

    var title: String
    var lines: [Line]
}

enum ChartCalloutPlacement {
    /// Over whatever sits above the plot, as Apple Health does.
    case above
    /// Inside the plot, beside the rule, for a chart in a container that clips what is above it, such as a pager page.
    case beside
}

extension View {
    /// Makes a Swift Charts chart interactive, as Apple Health's are. A tap selects the nearest point and a tap on it
    /// again clears it. A horizontal drag scrubs across time, and so does a drag after a short hold, which is the only
    /// way to scrub inside a horizontal pager, whose swipe a horizontal drag still pages. The selection stays after
    /// the finger lifts. `xs` are the points' x values in plotted order; a bar's should be its middle, such as noon
    /// for a day. `callout` formats only the selected point.
    ///
    /// The rule and callout draw in the chart's overlay with their own state, so a drag never re-evaluates the
    /// chart's marks or the screen that derived them.
    func chartScrubbing<X: Plottable & Equatable>(
        _ xs: [X], placement: ChartCalloutPlacement = .above, callout: @escaping (Int) -> ChartCallout
    ) -> some View {
        chartOverlay { proxy in
            ChartScrubOverlay(proxy: proxy, xs: xs, placement: placement, callout: callout)
        }
    }
}

private struct ChartScrubOverlay<X: Plottable & Equatable>: View {
    let proxy: ChartProxy
    let xs: [X]
    let placement: ChartCalloutPlacement
    let callout: (Int) -> ChartCallout

    @State private var selected: Int?
    @State private var calloutSize = CGSize.zero

    var body: some View {
        GeometryReader { geometry in
            let plot = proxy.plotFrame.map { geometry[$0] } ?? .zero
            Color.clear
                .contentShape(.rect)
                .gesture(ScrubRecognizer(kind: .tap) { location in
                    let index = nearest(location.x - plot.minX)
                    selected = index == selected ? nil : index
                })
                .gesture(ScrubRecognizer(kind: .pan) { location in selected = nearest(location.x - plot.minX) })
                .gesture(ScrubRecognizer(kind: .hold) { location in selected = nearest(location.x - plot.minX) })
                .overlay(alignment: .topLeading) {
                    if let selected, selected < xs.count, let x = proxy.position(forX: xs[selected]) {
                        selection(callout(selected), x: plot.minX + x, plot: plot, width: geometry.size.width)
                    }
                }
        }
        .sensoryFeedback(.selection, trigger: selected) { _, new in new != nil }
        .onChange(of: xs) { selected = nil }
    }

    private func selection(_ callout: ChartCallout, x: CGFloat, plot: CGRect, width: CGFloat) -> some View {
        let half = calloutSize.width / 2
        let center: CGPoint = switch placement {
        case .above: CGPoint(x: min(max(x, half), max(width - half, half)), y: plot.minY - calloutSize.height / 2 - 4)
        case .beside: CGPoint(x: x + half + 6 <= plot.maxX - half ? x + half + 6 : x - half - 6, y: plot.minY + calloutSize.height / 2)
        }
        return ZStack(alignment: .topLeading) {
            Rectangle()
                .fill(Theme.textSecondary)
                .frame(width: 1, height: plot.height)
                .position(x: x, y: plot.midY)
            ChartCalloutView(callout: callout)
                .onGeometryChange(for: CGSize.self) { $0.size } action: { calloutSize = $0 }
                .position(center)
        }
        .allowsHitTesting(false)
    }

    /// Binary search over the points' plotted positions, which grow with their order.
    private func nearest(_ x: CGFloat) -> Int? {
        guard !xs.isEmpty else { return nil }
        func position(_ index: Int) -> CGFloat { proxy.position(forX: xs[index]) ?? 0 }
        var low = 0
        var high = xs.count - 1
        while low < high {
            let middle = (low + high) / 2
            if position(middle) < x { low = middle + 1 } else { high = middle }
        }
        if low > 0, abs(position(low - 1) - x) < abs(position(low) - x) { return low - 1 }
        return low
    }
}

private struct ChartCalloutView: View {
    let callout: ChartCallout

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(callout.title).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
            ForEach(Array(callout.lines.enumerated()), id: \.offset) { _, line in
                HStack(spacing: 5) {
                    Circle().fill(line.color).frame(width: 7, height: 7)
                    if let label = line.label {
                        Text(label).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                    }
                    Text(line.value).font(AppFont.headline(14)).monospacedDigit()
                }
            }
        }
        .fixedSize()
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Theme.surfaceRaised, in: .rect(cornerRadius: Theme.smallCornerRadius))
        .accessibilityElement(children: .combine)
    }
}

/// UIKit recognizers rather than a SwiftUI `DragGesture`, which would also capture the vertical scrolls of the
/// screen around the chart. The pan begins only horizontally, and not at all inside a horizontally scrolling view
/// such as the Dashboard's focus pager, so the pager keeps its swipe and a vertical drag scrolls.
private struct ScrubRecognizer: UIGestureRecognizerRepresentable {
    enum Kind { case tap, pan, hold }

    let kind: Kind
    let changed: (CGPoint) -> Void

    func makeCoordinator(converter: CoordinateSpaceConverter) -> Coordinator { Coordinator() }

    func makeUIGestureRecognizer(context: Context) -> UIGestureRecognizer {
        let recognizer: UIGestureRecognizer = switch kind {
        case .tap: UITapGestureRecognizer()
        case .pan: UIPanGestureRecognizer()
        case .hold: {
            let hold = UILongPressGestureRecognizer()
            hold.minimumPressDuration = 0.25
            return hold
        }()
        }
        recognizer.delegate = context.coordinator
        return recognizer
    }

    func handleUIGestureRecognizerAction(_ recognizer: UIGestureRecognizer, context: Context) {
        switch recognizer.state {
        case .began, .changed, .ended: changed(context.converter.localLocation)
        default: break
        }
    }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        func gestureRecognizerShouldBegin(_ recognizer: UIGestureRecognizer) -> Bool {
            guard let pan = recognizer as? UIPanGestureRecognizer else { return true }
            let velocity = pan.velocity(in: nil)
            return abs(velocity.x) > abs(velocity.y) && !Self.scrollsHorizontally(around: pan.view)
        }

        func gestureRecognizer(_ recognizer: UIGestureRecognizer, shouldBeRequiredToFailBy other: UIGestureRecognizer) -> Bool {
            recognizer is UIPanGestureRecognizer && other.view is UIScrollView
        }

        private static func scrollsHorizontally(around view: UIView?) -> Bool {
            var ancestor = view?.superview
            while let current = ancestor {
                if let scroll = current as? UIScrollView, scroll.isPagingEnabled || scroll.contentSize.width > scroll.bounds.width + 1 {
                    return true
                }
                ancestor = current.superview
            }
            return false
        }
    }
}
