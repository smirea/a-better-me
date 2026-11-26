import Feedback
import SwiftUI

/// The Pings tab's controls, in a glass drawer that takes the tab bar's place. "+" grows it out of the bar's own frame
/// while the bar leaves, and a drag down shrinks it back; it has no title and no close button, to keep its height for
/// the timeline. The system draws the tab bar, so the drawer cannot share its glass: it starts as a copy of the bar's
/// shape, measured on iOS 27 (a 60 pt capsule, 22 pt from the sides and the bottom of the screen).
struct PingDrawer<Content: View>: View {
    @Binding var isOpen: Bool
    /// How much of the screen's bottom the open drawer covers.
    let covers: (CGFloat) -> Void
    @ViewBuilder let content: Content

    @State private var drag: CGFloat = 0
    @State private var contentHeight: CGFloat = 0

    /// Whether every control shows without scrolling, which is when a drag anywhere on the drawer closes it. When they
    /// scroll, a drag on them scrolls and the grabber closes.
    private var fits: Bool { contentHeight <= Self.maxContentHeight }

    private static var barHeight: CGFloat { 60 }
    private static var barInset: CGFloat { 22 }
    private static var inset: CGFloat { 8 }
    /// Seven rows of chips, which leaves the header and a few rows of the timeline above the drawer.
    private static var maxContentHeight: CGFloat { 360 }

    var body: some View {
        // Closed, the shape is the bar's: narrower and higher than the drawer. The controls keep the drawer's width
        // throughout, so they never reflow while it grows.
        let shape = DrawerShape(inset: isOpen ? 0 : Self.barInset - Self.inset, radius: isOpen ? 34 : Self.barHeight / 2)
        VStack(spacing: 0) {
            // Built only while open: closed, the drawer is an empty copy of the bar, with nothing for VoiceOver to find.
            if isOpen {
                Capsule().fill(Theme.textTertiary).frame(width: 36, height: 5).frame(maxWidth: .infinity, minHeight: 22)
                    .contentShape(.rect)
                    .onTapGesture { isOpen = false }
                    .gesture(dismissDrag)
                    .accessibilityElement()
                    .accessibilityLabel("Close")
                    .accessibilityAddTraits(.isButton)
                    .transition(.opacity)
                // More controls than the drawer may take scroll inside it, and the grabber stays above them.
                ScrollView {
                    content.onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 }
                }
                .scrollDisabled(fits)
                .scrollIndicators(.hidden)
                .frame(height: min(contentHeight, Self.maxContentHeight))
                .transition(.opacity)
            }
        }
        .padding(.horizontal, 14)
        // Clear of the home indicator, which draws over the drawer's bottom edge.
        .padding(.bottom, 22)
        .frame(maxWidth: .infinity)
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { covers($0 + Self.inset) }
        .frame(height: isOpen ? nil : Self.barHeight, alignment: .top)
        .clipShape(shape)
        .contentShape(shape)
        .glassEffect(.regular, in: shape)
        .padding([.horizontal, .bottom], Self.inset)
        // The timeline scrolls under the drawer and would show in the gap below it, so it fades out behind the glass.
        .background {
            LinearGradient(colors: [Theme.background.opacity(0), Theme.background], startPoint: .top, endPoint: UnitPoint(x: 0.5, y: 0.4))
                .allowsHitTesting(false)
        }
        .offset(y: isOpen ? drag : Self.inset - Self.barInset)
        .opacity(isOpen ? 1 : 0)
        .allowsHitTesting(isOpen)
        // Over the chips' own taps: the drawer follows the finger, so a drag that began on a chip would end inside it
        // and log it.
        .highPriorityGesture(dismissDrag, including: fits ? .all : .subviews)
        .animation(.spring(duration: 0.45, bounce: 0.18), value: isOpen)
        // The controls report their height a frame after they are built, and again when a chip opens into its steps.
        .animation(.spring(duration: 0.3, bounce: 0.1), value: contentHeight)
        .frame(maxHeight: .infinity, alignment: .bottom)
        // The keyboard covers the drawer while a row's note is typed, instead of lifting it over the timeline.
        .ignoresSafeArea(.keyboard)
        .ignoresSafeArea(.container, edges: .bottom)
    }

    private var dismissDrag: some Gesture {
        DragGesture(minimumDistance: 8)
            .onChanged { value in
                let pulled = value.translation.height
                drag = pulled > 0 ? pulled : pulled / 8
            }
            .onEnded { value in
                let closes = value.translation.height > 70 || value.predictedEndTranslation.height > 200
                withAnimation(.spring(duration: 0.35, bounce: 0.15)) {
                    drag = 0
                    if closes { isOpen = false }
                }
            }
    }
}

private struct DrawerShape: Shape {
    var inset: CGFloat
    var radius: CGFloat

    var animatableData: AnimatablePair<CGFloat, CGFloat> {
        get { AnimatablePair(inset, radius) }
        set { (inset, radius) = (newValue.first, newValue.second) }
    }

    func path(in rect: CGRect) -> Path {
        RoundedRectangle(cornerRadius: radius, style: .continuous).path(in: rect.insetBy(dx: inset, dy: 0))
    }
}

/// The drawer's controls for one day: a chip per ping, in the pings' order. A boolean ping's chip logs it. A range
/// ping's chip opens into its steps, and a step logs it. A chip counts its day: a boolean's logs, a range's latest step.
/// Text, last, starts a note typed in its row on the timeline.
struct PingControls: View {
    let log: (Ping, Int) -> Void
    let write: () -> Void

    @Observe private var statuses: [PingStatus]
    /// The range ping whose steps are showing.
    @State private var open: UUID?

    init(day: CalendarDay, log: @escaping (Ping, Int) -> Void, write: @escaping () -> Void) {
        self.log = log
        self.write = write
        _statuses = Observe(PingStatus.on(day))
    }

    var body: some View {
        FlowLayout(spacing: 8) {
            ForEach(statuses) { status in
                let ping = status.ping
                if ping.kind == .boolean {
                    chip(status) { log(ping, 1) }
                } else if open == ping.id {
                    PingStepsBesideTitle(ping: ping, picked: nil, ringed: status.step, fill: Theme.textPrimary.opacity(0.12)) { value in
                        log(ping, value)
                        open = nil
                    }
                    .padding(.horizontal, 12)
                    .frame(maxWidth: .infinity)
                    .background(Theme.surfaceRaised, in: .rect(cornerRadius: 20))
                    .contentShape(.rect)
                    .onTapGesture { open = nil }
                } else {
                    chip(status) { open = ping.id }
                }
            }
            Button(action: write) {
                chipLabel(icon: "character.cursor.ibeam", tint: Theme.textSecondary, name: "Text", count: 0)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Write a note")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .animation(.snappy(duration: 0.25), value: open)
        .feedback(self)
    }

    private func chip(_ status: PingStatus, action: @escaping () -> Void) -> some View {
        let count = status.ping.kind == .boolean ? status.count : status.step ?? 0
        return Button(action: action) {
            chipLabel(icon: status.ping.icon, tint: status.ping.tint, name: status.ping.name, count: count)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Log \(status.ping.name)")
        .accessibilityValue(count == 0 ? "" : status.ping.kind == .boolean ? "\(count) today" : "Last \(count)")
    }

    private func chipLabel(icon: String, tint: Color, name: String, count: Int) -> some View {
        HStack(spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 14, weight: .semibold)).foregroundStyle(tint)
                Text(name).font(AppFont.chip).lineLimit(1)
            }
            if count > 0 {
                Text("\(count)").font(AppFont.number(13)).foregroundStyle(Theme.textSecondary)
            }
        }
        .foregroundStyle(Theme.textPrimary)
        .padding(.horizontal, 14)
        .frame(height: 44)
        .background(Theme.surfaceRaised, in: .capsule)
        .contentShape(.capsule)
    }
}
