import Charts
import SwiftUI
import UIKit

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
    /// Shows a Swift Charts chart's values on tap. A tap selects the nearest point; tapping it again, tapping outside
    /// the chart, or scrolling the chart clears it. Drags never select, so they stay free to scroll the chart, the
    /// screen, or a pager. `xs` are the points' x values in plotted order; a bar's should be its middle, such as noon
    /// for a day. `callout` formats only the selected point.
    ///
    /// The tap goes through `chartGesture`, which Swift Charts runs alongside its own scrolling. The rule and callout
    /// draw in the chart's overlay, which alone reads the selection, so a tap never re-evaluates the chart's marks or
    /// the screen that derived them.
    func chartScrubbing<X: Plottable & Equatable>(
        _ xs: [X], placement: ChartCalloutPlacement = .above, callout: @escaping (Int) -> ChartCallout
    ) -> some View {
        modifier(ChartScrubbing(xs: xs, placement: placement, callout: callout))
    }
}

@Observable
private final class ScrubSelection {
    var index: Int?
}

private struct ChartScrubbing<X: Plottable & Equatable>: ViewModifier {
    let xs: [X]
    let placement: ChartCalloutPlacement
    let callout: (Int) -> ChartCallout

    @State private var selection = ScrubSelection()

    func body(content: Content) -> some View {
        content
            .chartGesture { proxy in
                SpatialTapGesture().onEnded { tap in
                    let index = nearest(proxy, x: tap.location.x)
                    selection.index = index == selection.index ? nil : index
                }
            }
            .chartOverlay { proxy in
                ChartScrubOverlay(proxy: proxy, xs: xs, placement: placement, selection: selection, callout: callout)
            }
            .onChange(of: xs) { selection.index = nil }
    }

    private func nearest(_ proxy: ChartProxy, x: CGFloat) -> Int? {
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

private struct ChartScrubOverlay<X: Plottable & Equatable>: View {
    let proxy: ChartProxy
    let xs: [X]
    let placement: ChartCalloutPlacement
    let selection: ScrubSelection
    let callout: (Int) -> ChartCallout

    @State private var calloutSize = CGSize.zero

    var body: some View {
        GeometryReader { geometry in
            let plot = proxy.plotFrame.map { geometry[$0] } ?? .zero
            Color.clear
                .overlay(alignment: .topLeading) {
                    if let selected = selection.index, selected < xs.count, let x = proxy.position(forX: xs[selected]) {
                        marker(callout(selected), x: plot.minX + x, plot: plot, width: geometry.size.width)
                        OutsideTap { selection.index = nil }
                    }
                }
                // A scrollable chart's plot frame spans all its content, so it moves only when the chart scrolls.
                .onChange(of: plot.minX) { selection.index = nil }
        }
        .allowsHitTesting(false)
        .sensoryFeedback(.selection, trigger: selection.index) { _, new in new != nil }
    }

    private func marker(_ callout: ChartCallout, x: CGFloat, plot: CGRect, width: CGFloat) -> some View {
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
                .opacity(calloutSize == .zero ? 0 : 1)
                .position(center)
        }
    }
}

private struct ChartCalloutView: View {
    let callout: ChartCallout

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(callout.title).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
            ForEach(Array(callout.lines.enumerated()), id: \.offset) { _, line in
                HStack(spacing: 5) {
                    Circle().fill(line.color).frame(width: 7, height: 7)
                    if let label = line.label {
                        Text(label).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
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

/// Calls `action` on a tap anywhere in the window outside its own frame, while it is on screen. The recognizer sits on
/// the window and never cancels or delays the touch, so the tap still reaches whatever it landed on.
private struct OutsideTap: UIViewRepresentable {
    let action: () -> Void

    func makeUIView(context: Context) -> Catcher {
        let view = Catcher()
        view.isUserInteractionEnabled = false
        return view
    }

    func updateUIView(_ view: Catcher, context: Context) { view.action = action }

    static func dismantleUIView(_ view: Catcher, coordinator: ()) { view.detach() }

    final class Catcher: UIView, UIGestureRecognizerDelegate {
        var action: () -> Void = {}
        private lazy var tap: UITapGestureRecognizer = {
            let tap = UITapGestureRecognizer(target: self, action: #selector(tapped))
            tap.cancelsTouchesInView = false
            tap.delaysTouchesEnded = false
            tap.delegate = self
            return tap
        }()

        override func didMoveToWindow() {
            super.didMoveToWindow()
            detach()
            window?.addGestureRecognizer(tap)
        }

        func detach() { tap.view?.removeGestureRecognizer(tap) }

        @objc private func tapped(_ recognizer: UITapGestureRecognizer) {
            if !bounds.contains(recognizer.location(in: self)) { action() }
        }

        func gestureRecognizer(_ recognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
    }
}
