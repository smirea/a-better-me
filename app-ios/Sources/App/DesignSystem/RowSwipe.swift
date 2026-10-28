import SwiftUI
import UIKit

/// A button a swiped row reveals. On each edge the first action sits nearest the edge, and it is the one a full swipe
/// runs.
struct SwipeAction: Identifiable {
    let title: String
    let systemImage: String
    var tint = Theme.surfaceRaised
    let action: () -> Void

    var id: String { title }

    static func destructive(_ title: String, systemImage: String = "trash", action: @escaping () -> Void) -> SwipeAction {
        SwipeAction(title: title, systemImage: systemImage, tint: Theme.destructive, action: action)
    }
}

extension View {
    /// `swipeActions` for rows outside a `List`, such as the Food Log's tiles under its day pager. A horizontal drag
    /// reveals the actions and a vertical one scrolls. A drag toward an edge with no actions belongs to the enclosing
    /// scroll view, so a tile with only trailing actions still pages the day when swiped right.
    func rowSwipeActions(leading: [SwipeAction] = [], trailing: [SwipeAction] = [], fullSwipe: Bool = false) -> some View {
        modifier(RowSwipe(leading: leading, trailing: trailing, fullSwipe: fullSwipe))
    }
}

private struct RowSwipe: ViewModifier {
    let leading: [SwipeAction]
    let trailing: [SwipeAction]
    let fullSwipe: Bool

    @State private var offset: CGFloat = 0
    @State private var resting: CGFloat = 0
    @State private var width: CGFloat = 0
    @State private var armed = false

    private static let slot: CGFloat = 56

    func body(content: Content) -> some View {
        content
            .overlay {
                if resting != 0 {
                    Color.clear.contentShape(.rect).onTapGesture(perform: close)
                }
            }
            .offset(x: offset)
            .background { revealed }
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
            .gesture(HorizontalPan(
                allowsLeft: !trailing.isEmpty || offset > 0, allowsRight: !leading.isEmpty || offset < 0,
                changed: drag, ended: settle
            ))
            .sensoryFeedback(.impact(weight: .medium), trigger: armed) { _, armed in armed }
            .accessibilityActions {
                ForEach(leading + trailing) { action in
                    Button(action.title, action: action.action)
                }
            }
    }

    private var revealed: some View {
        HStack(spacing: 0) {
            if offset > 0 { buttons(leading, width: offset, atTrailingEdge: false) }
            Spacer(minLength: 0)
            if offset < 0 { buttons(trailing, width: -offset, atTrailingEdge: true) }
        }
    }

    private func buttons(_ actions: [SwipeAction], width: CGFloat, atTrailingEdge: Bool) -> some View {
        let shown = armed ? Array(actions.prefix(1)) : actions
        return HStack(spacing: 0) {
            ForEach(atTrailingEdge ? shown.reversed() : shown) { action in
                Button {
                    close()
                    action.action()
                } label: {
                    Image(systemName: action.systemImage)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(action.tint == Theme.surfaceRaised ? Theme.textPrimary : .white)
                        .frame(width: 44, height: 44)
                        .background(action.tint, in: .circle)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(action.title)
            }
        }
        .frame(width: width)
        .clipped()
    }

    private func limit(_ x: CGFloat) -> CGFloat {
        CGFloat((x < 0 ? trailing : leading).count) * Self.slot + 8
    }

    private func drag(_ translation: CGFloat) {
        var x = resting + translation
        if leading.isEmpty { x = min(x, 0) }
        if trailing.isEmpty { x = max(x, 0) }
        let limit = limit(x)
        if !fullSwipe, abs(x) > limit {
            x = (x < 0 ? -1 : 1) * (limit + (abs(x) - limit) * 0.2)
        }
        offset = x
        armed = fullSwipe && abs(x) > max(width * 0.55, limit + 40)
    }

    private func settle(_ translation: CGFloat, velocity: CGFloat) {
        if armed, let action = offset < 0 ? trailing.first : leading.first {
            close()
            action.action()
            return
        }
        let projected = offset + velocity * 0.1
        let opens = abs(projected) > limit(projected) / 2 && (projected < 0 ? !trailing.isEmpty : !leading.isEmpty)
        withAnimation(.snappy) {
            resting = opens ? (projected < 0 ? -1 : 1) * limit(projected) : 0
            offset = resting
        }
    }

    private func close() {
        armed = false
        withAnimation(.snappy) {
            offset = 0
            resting = 0
        }
    }
}

/// A pan that only begins horizontally, toward an edge that has actions. Enclosing scroll views wait for it to fail,
/// so a swipe on a row never also pages or scrolls them.
private struct HorizontalPan: UIGestureRecognizerRepresentable {
    let allowsLeft: Bool
    let allowsRight: Bool
    let changed: (CGFloat) -> Void
    let ended: (CGFloat, _ velocity: CGFloat) -> Void

    func makeCoordinator(converter: CoordinateSpaceConverter) -> Coordinator { Coordinator() }

    func makeUIGestureRecognizer(context: Context) -> UIPanGestureRecognizer {
        let pan = UIPanGestureRecognizer()
        pan.delegate = context.coordinator
        return pan
    }

    func updateUIGestureRecognizer(_ recognizer: UIPanGestureRecognizer, context: Context) {
        context.coordinator.allowsLeft = allowsLeft
        context.coordinator.allowsRight = allowsRight
    }

    func handleUIGestureRecognizerAction(_ recognizer: UIPanGestureRecognizer, context: Context) {
        let translation = recognizer.translation(in: nil).x
        switch recognizer.state {
        case .changed: changed(translation)
        case .ended: ended(translation, recognizer.velocity(in: nil).x)
        case .cancelled, .failed: ended(translation, 0)
        default: break
        }
    }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        var allowsLeft = false
        var allowsRight = false

        func gestureRecognizerShouldBegin(_ recognizer: UIGestureRecognizer) -> Bool {
            guard let pan = recognizer as? UIPanGestureRecognizer else { return false }
            let velocity = pan.velocity(in: nil)
            guard abs(velocity.x) > abs(velocity.y) else { return false }
            return velocity.x < 0 ? allowsLeft : allowsRight
        }

        func gestureRecognizer(_ recognizer: UIGestureRecognizer, shouldBeRequiredToFailBy other: UIGestureRecognizer) -> Bool {
            other.view is UIScrollView
        }
    }
}
