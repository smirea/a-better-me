import SwiftUI

/// Ramble: say what you ate and the foods arrive one at a time as the server's model reads the words. It takes the
/// whole screen, since a lot moves at once: the day's new macros at the top, the foods in the middle under their hours,
/// the transcript and the mic at the bottom. The words an item was parsed from light up in the transcript and fly into
/// its row, which shows what was said until the search matches a food. A row's serving is a menu, a swipe removes it,
/// edits its amount, or swaps it, and a tap lifts it into focus with its other matches below. Nothing is logged until
/// Add (docs/decisions/nutrition.md, Ramble logging).
struct RambleTab: View {
    let session: LoggerSession
    /// Opens a food row's detail, with the serving keyboard.
    let open: (RambleRow) -> Void
    let close: () -> Void
    /// Leaves Ramble for another way to log.
    let switchTo: (LoggerTab) -> Void
    /// Leaves for Search with a food the ramble found no match for.
    let search: (String) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var saved = 0
    /// Words on their way from the transcript to a row.
    @State private var flights: [Flight] = []
    /// Rows whose words were just parsed, by key, with the flight that lit them; their words stay highlighted a moment.
    @State private var fresh: [Int: UUID] = [:]
    /// The row lifted into focus, by key, with its other matches under it.
    @State private var focused: Int?

    private var capture: RambleCapture { session.ramble }
    private var live: Bool { capture.phase == .listening || capture.phase == .finishing }

    var body: some View {
        VStack(spacing: 0) {
            RambleSummary(
                planned: capture.shownPlanned, missing: capture.notFound, close: close, switchTo: switchTo
            )
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        if capture.rows.isEmpty, capture.words.words.isEmpty, capture.phase != .review {
                            hints.transition(.opacity)
                        }
                        let headers = Self.headers(capture.rows)
                        ForEach(capture.rows, id: \.key) { row in
                            if let header = headers[row.key] {
                                Chip(title: header, size: .small)
                                    .fixedSize()
                                    .padding(.top, 14)
                                    .padding(.bottom, 2)
                                    .transition(.opacity.combined(with: .scale(scale: 0.8, anchor: .leading)))
                                    .accessibilityAddTraits(.isHeader)
                            }
                            RambleLine(
                                row: row, capture: capture, incoming: live && capture.spans[row.key] != nil,
                                focus: focused == nil ? .none : focused == row.key ? .lifted : .dimmed,
                                tap: {
                                    if row.content == .unmatched { return search(row.item.name) }
                                    withAnimation(.spring(duration: 0.38, bounce: 0.2)) { focused = focused == row.key ? nil : row.key }
                                },
                                open: { open(row) }
                            )
                            .id(row.key)
                            .zIndex(focused == row.key ? 1 : 0)
                            .transition(arrival)
                        }
                        if let notice = capture.notice {
                            Text(notice)
                                .font(AppFont.caption())
                                .foregroundStyle(Theme.textSecondary)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: .infinity)
                                .padding(.top, 12)
                        }
                    }
                    .padding(.horizontal, Theme.margin)
                    .padding(.vertical, 8)
                }
                .scrollIndicators(.hidden)
                .onChange(of: capture.rows.count) { old, new in
                    guard new > old, focused == nil, let last = capture.rows.last else { return }
                    withAnimation(.smooth) { proxy.scrollTo(last.key, anchor: .bottom) }
                }
                .onChange(of: focused) { _, key in
                    guard let key else { return }
                    withAnimation(.smooth) { proxy.scrollTo(key, anchor: .top) }
                }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { footer }
        .overlayPreferenceValue(RambleAnchors.self) { anchors in
            GeometryReader { geometry in
                ForEach(flights) { flight in
                    // A row scrolled out of view, above the list or under the transcript, gets no flight.
                    if let to = anchors.rows[flight.key].map({ geometry[$0] }),
                       let from = flight.words.compactMap({ anchors.words[$0].map { geometry[$0] } }).reduce(nil, { $0?.union($1) ?? $1 }),
                       to.minY >= 0, to.maxY <= from.minY {
                        FlightView(flight: flight, from: from, to: to)
                    }
                }
            }
            .allowsHitTesting(false)
        }
        .onChange(of: capture.rows) { old, new in
            launch(from: old, to: new)
            // A spoken "show me the options" lifts that row; a focused row that left lets go.
            if let asked = new.first(where: { row in
                guard case let .food(food) = row.content else { return false }
                return food.showsOptions && !old.contains { $0.key == row.key && $0.content == row.content }
            }) {
                withAnimation(.spring(duration: 0.38, bounce: 0.2)) { focused = asked.key }
            } else if let key = focused, !new.contains(where: { $0.key == key }) {
                withAnimation(.smooth) { focused = nil }
            }
        }
        .animation(reduceMotion ? nil : .spring(duration: 0.42, bounce: 0.18), value: capture.rows)
        .animation(.snappy(duration: 0.25), value: capture.phase)
        .sensoryFeedback(trigger: capture.rows.count) { old, new in new > old ? .impact(weight: .light, intensity: 0.6) : nil }
        .sensoryFeedback(.selection, trigger: focused)
        .sensoryFeedback(.success, trigger: saved)
        .task {
            if capture.phase == .idle { await capture.start() }
        }
        .onDisappear {
            Task { await capture.stop() }
        }
    }

    /// Each row that starts a new hour, or a new day, gets that hour as a header, as the Food Log groups its foods.
    static func headers(_ rows: [RambleRow], today: CalendarDay = .today) -> [Int: String] {
        var headers: [Int: String] = [:]
        var last: String?
        for row in rows {
            let hour = row.minute.map { NutritionFormat.hour($0 / 60) } ?? "Their own times"
            let label = row.day == today ? hour : "\(NutritionFormat.dayTitle(row.day, today: today)) · \(hour)"
            if label != last { headers[row.key] = label }
            last = label
        }
        return headers
    }

    /// A row that appears while the speaker talks gets its words from the transcript; one whose quote changes, by a
    /// spoken correction, gets the correcting words.
    private func launch(from old: [RambleRow], to new: [RambleRow]) {
        guard live, !reduceMotion else { return }
        let before = Dictionary(old.map { ($0.key, $0) }, uniquingKeysWith: { $1 })
        for row in new {
            guard let span = capture.spans[row.key] else { continue }
            let kind: Flight.Kind
            if let earlier = before[row.key] {
                // Only words said after the item's own are a correction; a requote of the same words is the model settling.
                let changed = earlier.item.name != row.item.name || earlier.item.amount != row.item.amount || earlier.item.unit != row.item.unit
                guard changed, let was = capture.words.span(of: earlier.item.said), span.lowerBound > was.lowerBound else { continue }
                kind = .correction
            } else {
                kind = .parse
            }
            let text = capture.words.words[span].map(\.text).joined(separator: " ")
            let flight = Flight(key: row.key, words: span, text: text, kind: kind)
            flights.append(flight)
            fresh[row.key] = flight.id
            Task {
                try? await Task.sleep(for: Flight.duration + .milliseconds(100))
                flights.removeAll { $0.id == flight.id }
                try? await Task.sleep(for: .seconds(2.5))
                if fresh[row.key] == flight.id { fresh[row.key] = nil }
            }
        }
    }

    private var arrival: AnyTransition {
        guard !reduceMotion else { return .opacity }
        return .asymmetric(
            insertion: .modifier(active: Arrive(progress: 0), identity: Arrive(progress: 1)),
            removal: .modifier(active: Leave(progress: 1), identity: Leave(progress: 0))
        )
    }

    private var hints: some View {
        VStack(spacing: 8) {
            Text("Just say what you ate.")
                .font(AppFont.title(22))
            Text("Amounts, meals, days, and corrections fall into place as you talk.")
                .font(AppFont.caption(14))
                .foregroundStyle(Theme.textSecondary)
            VStack(spacing: 10) {
                ForEach(Self.examples, id: \.self) { Text("“\($0)”") }
            }
            .font(AppFont.caption())
            .foregroundStyle(Theme.textTertiary)
            .padding(.top, 16)
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }

    private static let examples = [
        "Two eggs and a slice of toast for breakfast",
        "Same lunch as yesterday but without the rice",
        "200 grams of chicken, actually make that 250",
    ]

    private var footer: some View {
        VStack(spacing: 6) {
            if !capture.words.words.isEmpty, live || capture.phase == .review {
                RambleTranscript(words: capture.words, spans: capture.spans, fresh: Set(fresh.keys), struck: capture.struck, live: live)
                    .transition(.opacity)
            }
            if capture.phase == .listening {
                RambleWaveform(meter: capture.meter, active: true)
                    .frame(height: 40)
                    .transition(.opacity)
            }
            if capture.phase == .finishing {
                Label("Catching the last words", systemImage: "sparkles")
                    .font(AppFont.badge)
                    .foregroundStyle(Theme.accent)
                    .symbolEffect(.pulse, options: .repeating)
                    .transition(.opacity.combined(with: .scale(scale: 0.9)))
            }
            HStack(spacing: 12) {
                micButton
                if capture.phase == .review || capture.phase == .finishing, !capture.planned.isEmpty {
                    let count = capture.planned.count
                    Button {
                        saved += 1
                        Task { await session.logRamble() }
                    } label: {
                        Text(count == 1 ? "Add 1 Food" : "Add \(count) Foods")
                            .font(AppFont.headline(16))
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .contentTransition(.numericText())
                    }
                    .prominentButton()
                    .buttonBorderShape(.capsule)
                    .transition(.move(edge: .trailing).combined(with: .opacity))
                }
            }
            .frame(height: 64)
        }
        .padding(.horizontal, Theme.margin)
        .padding(.bottom, 8)
        .padding(.top, 24)
        // The rows scroll under the transcript; the fade keeps its words readable.
        .background {
            LinearGradient(stops: [.init(color: Theme.background.opacity(0), location: 0), .init(color: Theme.background, location: 0.2)], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
                .allowsHitTesting(false)
        }
    }

    @ViewBuilder private var micButton: some View {
        switch capture.phase {
        case .listening, .finishing:
            Button {
                Task { await capture.stop() }
            } label: {
                ZStack {
                    if capture.phase == .listening {
                        RoundedRectangle(cornerRadius: 5, style: .continuous).frame(width: 18, height: 18)
                    } else {
                        Image(systemName: "waveform")
                            .font(.title3.weight(.semibold))
                            .symbolEffect(.variableColor.iterative, options: .repeating)
                    }
                }
                .foregroundStyle(Theme.onPrimary)
                .frame(width: 60, height: 60)
                .glassEffect(.regular.tint(Theme.accent).interactive(), in: .circle)
            }
            .buttonStyle(.plain)
            .disabled(capture.phase != .listening)
            .accessibilityLabel(capture.phase == .listening ? "Stop listening" : "Reading the ramble")
            .frame(maxWidth: capture.planned.isEmpty || capture.phase == .listening ? .infinity : nil)
        case .idle, .review:
            Button {
                Task { await capture.start() }
            } label: {
                Image(systemName: "mic.fill")
                    .font(.title3.weight(.semibold))
                    .frame(width: 60, height: 60)
                    .glassEffect(.regular.interactive(), in: .circle)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(capture.isEmpty ? "Start talking" : "Keep talking")
            .frame(maxWidth: capture.planned.isEmpty ? .infinity : nil)
        }
    }
}

/// The top band: close, the ramble's calories and macros so far, rolling as foods land, and the other ways to log.
private struct RambleSummary: View {
    let planned: [RamblePlanned]
    /// Foods said but not found, which the totals leave out.
    let missing: Int
    let close: () -> Void
    let switchTo: (LoggerTab) -> Void
    @State private var pulse = 0.0

    var body: some View {
        let amounts = planned.reduce(into: NutrientAmounts()) { $0 = $0 + $1.pick.portion.amounts }
        let kcal = Int((amounts[.energy] ?? 0).rounded())
        HStack(spacing: 12) {
            Button("Close", systemImage: "xmark", action: close)
                .labelStyle(.iconOnly)
                .frame(width: 44, height: 44)
                .glassEffect(.regular.interactive(), in: .circle)
            VStack(spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("\(kcal)").font(AppFont.number(26)).contentTransition(.numericText(value: Double(kcal)))
                    Text("kcal").font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
                }
                HStack(spacing: 12) {
                    macro("P", .protein, amounts, Theme.protein)
                    macro("F", .fat, amounts, Theme.fat)
                    macro("C", .carbs, amounts, Theme.carbs)
                }
                if missing > 0 {
                    Text(missing == 1 ? "1 food not found" : "\(missing) foods not found")
                        .font(AppFont.badge)
                        .foregroundStyle(Theme.amber)
                        .transition(.opacity.combined(with: .scale(scale: 0.9)))
                }
            }
            .scaleEffect(1 + 0.06 * pulse)
            .frame(maxWidth: .infinity)
            .accessibilityElement(children: .combine)
            Menu {
                ForEach(LoggerTab.allCases.filter { $0 != .ramble }, id: \.self) { tab in
                    Button(tab.title, systemImage: tab.systemImage) { switchTo(tab) }
                }
            } label: {
                Image(systemName: "square.grid.2x2")
                    .frame(width: 44, height: 44)
                    .glassEffect(.regular.interactive(), in: .circle)
            }
            .accessibilityLabel("Other ways to log")
        }
        .padding(.horizontal, Theme.margin)
        .padding(.vertical, 6)
        .animation(.snappy(duration: 0.35), value: kcal)
        .onChange(of: kcal) {
            pulse = 1
            withAnimation(.spring(duration: 0.5, bounce: 0.4)) { pulse = 0 }
        }
    }

    private func macro(_ letter: String, _ id: NutrientID, _ amounts: NutrientAmounts, _ color: Color) -> some View {
        let grams = Int((amounts[id] ?? 0).rounded())
        return HStack(spacing: 3) {
            Text(letter).font(.system(size: 10, weight: .heavy)).foregroundStyle(color)
            Text("\(grams)g").font(AppFont.medium(13)).monospacedDigit().contentTransition(.numericText(value: Double(grams)))
        }
    }
}

/// Where the transcript's words and the rows are on screen, for the words flying between them.
struct RambleAnchors: PreferenceKey {
    struct Value {
        var words: [Int: Anchor<CGRect>] = [:]
        var rows: [Int: Anchor<CGRect>] = [:]
    }

    static let defaultValue = Value()

    static func reduce(value: inout Value, nextValue: () -> Value) {
        let next = nextValue()
        value.words.merge(next.words) { $1 }
        value.rows.merge(next.rows) { $1 }
    }
}

private struct Flight: Identifiable, Equatable {
    enum Kind { case parse, correction }

    static let duration = Duration.milliseconds(550)

    let id = UUID()
    /// The row's `RambleRow.key`.
    let key: Int
    let words: Range<Int>
    let text: String
    let kind: Kind
}

/// The words of a flight: they lift out of the transcript as a highlighted chip, arc up into the row, and fade as the
/// row's own content takes their place.
private struct FlightView: View {
    let flight: Flight
    let from: CGRect
    let to: CGRect
    @State private var progress = 0.0

    var body: some View {
        Group {
            if flight.kind == .parse {
                Text(flight.text)
                    .lineLimit(1)
                    .font(AppFont.medium(14))
                    .foregroundStyle(Theme.textPrimary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Theme.accent.opacity(0.35), in: .capsule)
                    .overlay { Capsule().strokeBorder(Theme.accent, lineWidth: 1) }
                    .fixedSize()
            } else {
                // A correction's row sits above other rows, so its cue is a badge small enough to travel up the
                // margin, clear of their text; its words light up in the transcript meanwhile.
                Image(systemName: "arrow.uturn.backward")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Theme.onPrimary)
                    .frame(width: 20, height: 20)
                    .background(Theme.accent, in: .circle)
            }
        }
        .modifier(Fly(progress: progress, from: from, to: to, margin: flight.kind == .correction))
        .onAppear {
            // A correction changes its row at once, so its badge arrives quickly.
            let seconds = flight.kind == .correction ? 0.3 : Double(Flight.duration.components.attoseconds) / 1e18
            withAnimation(.timingCurve(0.3, 0, 0.2, 1, duration: seconds)) { progress = 1 }
        }
    }
}

private struct Fly: ViewModifier, @MainActor Animatable {
    var progress: Double
    let from: CGRect
    let to: CGRect
    /// Up the leading margin to the row's icon, rather than an arc over the rows.
    let margin: Bool

    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    func body(content: Content) -> some View {
        // A correction starts in the margin beside its words, so the badge never covers them.
        let start = CGPoint(x: margin ? min(from.minX, to.minX) - 10 : from.midX, y: from.midY)
        let end = margin ? CGPoint(x: to.minX + 14, y: to.midY) : CGPoint(x: to.minX + min(110, to.width * 0.3), y: to.midY)
        // Up and over for words; for a correction, out to the margin, then straight up it.
        let control = margin
            ? CGPoint(x: start.x, y: (start.y + to.midY) / 2)
            : CGPoint(x: (start.x + end.x) / 2, y: min(start.y, end.y) - 60)
        let t = progress
        let point = CGPoint(
            x: (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * control.x + t * t * end.x,
            y: (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * control.y + t * t * end.y
        )
        return content
            .scaleEffect(margin ? 1 + 0.5 * max(0, t - 0.8) / 0.2 : 1 + 0.12 * sin(t * .pi) - 0.15 * t)
            .opacity(margin ? (t < 0.85 ? 1 : (1 - t) / 0.15) : (t < 0.6 ? 1 : (1 - t) / 0.4))
            .position(point)
    }
}

/// The transcript, a view per word: committed words settle in, the words still being heard stay dim, the words of a
/// row stand out, the ones just parsed highlighted, and the words of a row taken back are struck through.
private struct RambleTranscript: View {
    let words: RambleWords
    let spans: [Int: Range<Int>]
    /// Row keys whose words were just parsed.
    let fresh: Set<Int>
    let struck: Set<Int>
    let live: Bool

    var body: some View {
        let parsed = Set(spans.values.flatMap { $0 })
        let highlighted = Set(spans.filter { fresh.contains($0.key) }.values.flatMap { $0 })
        ScrollView {
            FlowLayout(spacing: 0) {
                ForEach(words.words.indices, id: \.self) { index in
                    let word = words.words[index]
                    let lit = highlighted.contains(index)
                    let gone = !parsed.contains(index) && struck.contains(index)
                    Text(word.text)
                        .font(AppFont.body(16))
                        .strikethrough(gone, color: Theme.textTertiary)
                        .foregroundStyle(parsed.contains(index) ? Theme.textPrimary : gone || word.partial ? Theme.textTertiary : Theme.textSecondary)
                        .padding(.horizontal, 2.5)
                        .padding(.vertical, 1)
                        .background {
                            if lit { RoundedRectangle(cornerRadius: 5, style: .continuous).fill(Theme.accent.opacity(0.28)) }
                        }
                        .padding(.vertical, 1.5)
                        .anchorPreference(key: RambleAnchors.self, value: .bounds) { parsed.contains(index) ? RambleAnchors.Value(words: [index: $0]) : RambleAnchors.Value() }
                        .transition(.opacity.combined(with: .blurReplace))
                        .contentTransition(.interpolate)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .animation(.easeOut(duration: 0.25), value: words)
            .animation(.easeOut(duration: 0.3), value: spans)
            .animation(.easeOut(duration: 0.6), value: fresh)
            .animation(.easeOut(duration: 0.3), value: struck)
        }
        .defaultScrollAnchor(.bottom)
        .scrollIndicators(.hidden)
        .frame(maxHeight: live ? 104 : 56)
        .fixedSize(horizontal: false, vertical: true)
        .mask {
            LinearGradient(stops: [.init(color: .clear, location: 0), .init(color: .black, location: 0.22)], startPoint: .top, endPoint: .bottom)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Transcript, \(words.words.map(\.text).joined(separator: " "))")
    }
}

/// One food of the ramble, plain like the Food Log's: icon, name, nutrition, and the serving on the right as a menu.
/// It shows what was said until its search matches, then crossfades to the match; a correction lights it and strikes
/// through a renamed food. Lifted into focus, its other matches list under it to swap to.
private struct RambleLine: View {
    enum Focus { case none, lifted, dimmed }

    let row: RambleRow
    let capture: RambleCapture
    /// Its words are flying in from the transcript, so its content shows as they land.
    let incoming: Bool
    let focus: Focus
    let tap: () -> Void
    let open: () -> Void

    init(row: RambleRow, capture: RambleCapture, incoming: Bool, focus: Focus, tap: @escaping () -> Void, open: @escaping () -> Void) {
        self.row = row
        self.capture = capture
        self.incoming = incoming
        self.focus = focus
        self.tap = tap
        self.open = open
        // Set as the row is created, so its first frame already holds what was said; rows coming back into view after a
        // tab switch are not new.
        let live = capture.phase == .listening || capture.phase == .finishing
        _landed = State(initialValue: !(live && incoming))
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// 1 just after the row arrived or changed, easing to 0.
    @State private var glow = 0.0
    /// What a correction replaced, struck through until it fades.
    @State private var was: String?
    @State private var landed: Bool
    /// The owner removed the row; it flushes red before it goes.
    @State private var removing = false
    /// A row's first moments are the model settling on what it heard ("dinner" becomes "pork loin"), not a correction.
    @State private var born = ContinuousClock.now
    @State private var allOptions = false

    /// The flight's words land, and the row's content shows, this long after the row appears.
    static let landing = Duration.milliseconds(550)

    /// No local match, and the online search is still looking.
    private var onlineSearch: Bool { row.content == .unmatched && capture.searchingOnline.contains(row.item.name.lowercased()) }

    /// The local search knew nothing and the online one was asked: shown as its own stage while the row holds what was
    /// said, even when the answer came back sooner.
    private var wentOnline: Bool { capture.askedOnline.contains(row.item.name.lowercased()) }

    private var parsing: Bool { row.content == .searching || (!reduceMotion && capture.parsing.contains(row.key)) }

    /// What the row says; a change to it is a correction worth showing.
    private struct Face: Equatable {
        var title: String
        var serving: String
        var placement: String
        var resolved: Bool
    }

    private var face: Face {
        let placement = "\(row.day) \(row.minute ?? -1)"
        return switch row.content {
        case let .food(food): Face(title: food.pick.portion.food.displayName, serving: NutritionFormat.serving(food.pick.portion.serving), placement: placement, resolved: true)
        case let .copy(copy): Face(title: Self.title(copy), serving: "\(copy.entries.count)", placement: placement, resolved: true)
        case .searching: Face(title: row.item.name, serving: Self.spoken(row.item) ?? "", placement: placement, resolved: false)
        case .unmatched: Face(title: row.item.name, serving: "", placement: placement, resolved: true)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            line
            if focus == .lifted, case let .food(food) = row.content, !parsing {
                alternatives(food)
                    .transition(.opacity.animation(.easeOut(duration: 0.2).delay(0.12)))
            }
        }
        .padding(.horizontal, focus == .lifted ? 10 : 0)
        .background {
            let shape = RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
            ZStack {
                if focus == .lifted { shape.fill(Theme.surface).shadow(color: .black.opacity(0.5), radius: 18, y: 8) }
                shape.fill(Theme.accent.opacity(0.14 * glow))
                if removing { shape.fill(Theme.destructive.opacity(0.3)) }
            }
            .padding(.horizontal, focus == .lifted ? 0 : -8)
        }
        .clipShape(.rect(cornerRadius: focus == .lifted ? Theme.cornerRadius : 0))
        .scaleEffect(focus == .lifted ? 1.02 : 1)
        .opacity(focus == .dimmed ? 0.35 : 1)
        .blur(radius: focus == .dimmed ? 1.5 : 0)
        .offset(x: removing ? -14 : 0)
        .anchorPreference(key: RambleAnchors.self, value: .bounds) { RambleAnchors.Value(rows: [row.key: $0]) }
        .rowSwipeActions(
            leading: row.content.isFood ? [SwipeAction(title: "Swap", systemImage: "arrow.left.arrow.right", tint: Theme.accent, action: tap)] : [],
            trailing: [.destructive("Remove", action: removeByOwner)] + (row.content.isFood ? [SwipeAction(title: "Amount", systemImage: "scalemass", action: open)] : [])
        )
        .onAppear {
            if reduceMotion {
                landed = true
            } else if !landed {
                withAnimation(.easeOut(duration: 0.2).delay(0.35)) { landed = true }
                Task {
                    try? await Task.sleep(for: Self.landing)
                    light()
                }
            } else if capture.phase == .listening || capture.phase == .finishing {
                light()
            }
        }
        .onChange(of: capture.edited) {
            guard capture.editedKey == row.key else { return }
            // After the detail's page slides away, so the change shows on the list.
            Task {
                try? await Task.sleep(for: .milliseconds(350))
                light()
            }
        }
        .onChange(of: face) { old, new in
            // A row searching for its food is not corrected by finding it, and a changed amount rolls in place.
            let settled = ContinuousClock.now - born >= .seconds(1.5)
            if settled, old.resolved, new.title != old.title { was = old.title }
            if new.resolved != old.resolved, old.title == new.title { return }
            light()
        }
        .task(id: was) {
            guard was != nil else { return }
            try? await Task.sleep(for: .seconds(1.4))
            withAnimation(.easeOut(duration: 0.3)) { was = nil }
        }
        .animation(.smooth(duration: 0.3), value: wentOnline)
        .animation(.smooth(duration: 0.35), value: parsing)
        .sensoryFeedback(.selection, trigger: face)
        .sensoryFeedback(.impact(weight: .medium), trigger: removing) { _, new in new }
    }

    private var line: some View {
        HStack(spacing: 12) {
            // One slot: what was said blurs into the food it matched, never both laid out at once.
            ZStack(alignment: .leading) {
                HStack(spacing: 12) {
                    icon
                    VStack(alignment: .leading, spacing: 2) {
                        title
                        if let was {
                            Text(was)
                                .font(AppFont.rowDetail)
                                .strikethrough(color: Theme.accent)
                                .foregroundStyle(Theme.textTertiary)
                                .lineLimit(1)
                                .transition(.opacity.combined(with: .move(edge: .top)))
                                .accessibilityLabel("Was \(was)")
                        }
                        detail
                    }
                }
                .id(stage)
                .transition(.blurReplace)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(.rect)
            .onTapGesture(perform: tap)
            serving
        }
        .padding(.vertical, 10)
        .opacity(landed ? 1 : 0)
        .blur(radius: landed ? 0 : 4)
        .overlay {
            if parsing { Sheen().clipShape(.rect(cornerRadius: 8)).allowsHitTesting(false) }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAction(named: focus == .lifted ? "Hide other matches" : "Show other matches", tap)
    }

    /// What the row shows; another food is another stage, so a pick crossfades instead of morphing one name into the other.
    private var stage: String {
        if parsing { return "parsing" }
        return switch row.content {
        case .searching: "parsing"
        case let .food(food): "food \(food.key)"
        case .copy: "copy"
        case .unmatched: onlineSearch ? "online" : "unmatched"
        }
    }

    @ViewBuilder private var icon: some View {
        Group {
            if parsing {
                Image(systemName: wentOnline ? "globe" : "magnifyingglass")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.accent)
                    .symbolEffect(.pulse, options: .repeating)
                    .contentTransition(.symbolEffect(.replace))
            } else {
                switch row.content {
                case let .food(food): FoodIcon(food: food.pick.portion.food)
                case .copy: Image(systemName: "square.on.square").font(.system(size: 14, weight: .semibold))
                case .searching, .unmatched:
                    Image(systemName: onlineSearch ? "globe" : "questionmark")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(onlineSearch ? Theme.accent : Theme.textTertiary)
                        .symbolEffect(.pulse, options: .repeating, isActive: onlineSearch)
                }
            }
        }
        .frame(width: 28, height: 28)
    }

    @ViewBuilder private var title: some View {
        let text = parsing ? row.item.name : face.title
        Text(text.isEmpty ? "A meal" : text)
            .font(AppFont.rowTitle)
            .foregroundStyle(parsing ? Theme.accent : Theme.textPrimary)
            .lineLimit(focus == .lifted ? 2 : 1)
    }

    @ViewBuilder private var detail: some View {
        Group {
            if parsing {
                Text(wentOnline ? "Searching online…" : "Finding a match…")
                    .contentTransition(.opacity)
            } else {
                switch row.content {
                case let .food(food):
                    // The old line fades out before the new one fades in, so their digits never overlap.
                    ZStack(alignment: .leading) {
                        Text(macroLine: food.pick.portion.amounts)
                            .id(face.serving)
                            .transition(.asymmetric(
                                insertion: .opacity.animation(.easeIn(duration: 0.18).delay(0.14)),
                                removal: .opacity.animation(.easeOut(duration: 0.12))
                            ))
                    }
                case let .copy(copy): Text(copy.entries.map(\.food.name).joined(separator: " · "))
                case .searching, .unmatched: Text(onlineSearch ? "Searching online…" : "Not found. Tap to search for it.")
                }
            }
        }
        .font(AppFont.rowDetail)
        .foregroundStyle(Theme.textSecondary)
        .lineLimit(1)
    }

    /// The serving, right-aligned: a menu of the food's measures, and Custom for the serving keyboard.
    @ViewBuilder private var serving: some View {
        // The old amount fades out before the new one fades in, so they never overlap.
        let label = ZStack {
            Text(face.serving)
                .font(AppFont.medium(14))
                .monospacedDigit()
                .lineLimit(1)
                .id(face.serving)
                .transition(.asymmetric(
                    insertion: .opacity.animation(.easeIn(duration: 0.18).delay(0.14)),
                    removal: .opacity.animation(.easeOut(duration: 0.12))
                ))
        }
        .padding(.horizontal, 10)
        .frame(minHeight: 32)
        .background(Theme.surfaceRaised, in: .capsule)
        if !parsing, case let .food(food) = row.content {
            let current = food.pick.portion.serving
            Menu {
                ForEach(RambleServing.choices(current, of: food.pick.portion.food.nutrition), id: \.self) { serving in
                    Toggle(NutritionFormat.serving(serving), isOn: Binding(get: { serving == current }, set: { _ in capture.setServing(serving, of: row) }))
                }
                Divider()
                Button("Custom Amount", systemImage: "number", action: open)
            } label: { label }
            .accessibilityLabel("Serving, \(face.serving)")
            .accessibilityHint("Changes the serving")
        } else if !face.serving.isEmpty, row.content != .unmatched {
            label.foregroundStyle(parsing ? Theme.accent : Theme.textSecondary)
        }
    }

    /// The other matches, best first, to swap to.
    private func alternatives(_ food: RambleRow.Food) -> some View {
        let others = food.options.filter { $0.key != food.key }
        let shown = allOptions ? others : Array(others.prefix(4))
        return VStack(alignment: .leading, spacing: 0) {
            Text(others.isEmpty ? "No other matches" : "Other matches")
                .font(AppFont.badge)
                .foregroundStyle(Theme.textTertiary)
                .padding(.top, 4)
                .padding(.bottom, 2)
            ForEach(shown) { option in
                Button {
                    capture.pick(option, in: row)
                    tap()
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "arrow.left.arrow.right.circle")
                            .foregroundStyle(Theme.textTertiary)
                        FoodRow(food: option.portion.food, serving: RambleServing.serving(amount: row.item.amount, unit: row.item.unit, of: option.portion.food.nutrition, history: option.portion.serving))
                    }
                    .frame(minHeight: 44)
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .transition(.opacity)
            }
            if !allOptions, others.count > 4 {
                Button("Show \(others.count - 4) More") { withAnimation(.snappy) { allOptions = true } }
                    .font(AppFont.badge)
                    .foregroundStyle(Theme.textSecondary)
                    .frame(minHeight: 36)
            }
        }
        .padding(.leading, 40)
        .padding(.bottom, 8)
    }

    private func removeByOwner() {
        withAnimation(.easeOut(duration: 0.18)) { removing = true }
        Task {
            try? await Task.sleep(for: .milliseconds(180))
            // A read landing meanwhile may have moved the row to another position; its key still finds it.
            if let current = capture.rows.first(where: { $0.key == row.key }) { capture.remove(current) }
        }
    }

    private static func title(_ copy: RambleRow.Copy) -> String {
        "\(NutritionFormat.dayTitle(copy.meal.day))'s \(copy.meal.meal.title)"
    }

    private static func spoken(_ item: RambleItem) -> String? {
        guard item.amount > 0 else { return nil }
        let number = item.amount.formatted(.number.precision(.fractionLength(0 ... 2)))
        return item.unit.isEmpty ? "×\(number)" : "\(number) \(item.unit)"
    }

    private func light() {
        glow = 1
        withAnimation(.easeOut(duration: 1.6)) { glow = 0 }
    }
}

private extension RambleRow.Content {
    var isFood: Bool { if case .food = self { true } else { false } }
}

/// A row leaving: it shrinks, blurs, and drifts away to the side.
private struct Leave: ViewModifier {
    let progress: Double

    func body(content: Content) -> some View {
        content
            .opacity(1 - progress)
            .blur(radius: progress * 8)
            .scaleEffect(1 - progress * 0.08)
            .offset(x: -progress * 40)
    }
}

/// A band of light passing over a row while its food is searched for.
private struct Sheen: View {
    @State private var at = -1.0

    var body: some View {
        GeometryReader { proxy in
            LinearGradient(colors: [.clear, Theme.accent.opacity(0.16), .clear], startPoint: .leading, endPoint: .trailing)
                .frame(width: proxy.size.width * 0.5)
                .offset(x: at * proxy.size.width)
        }
        .allowsHitTesting(false)
        .onAppear {
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: false)) { at = 1.5 }
        }
        .transition(.opacity)
    }
}

/// A row arriving: it fades and sharpens in from just below.
private struct Arrive: ViewModifier {
    let progress: Double

    func body(content: Content) -> some View {
        content
            .opacity(progress)
            .blur(radius: (1 - progress) * 6)
            .offset(y: (1 - progress) * 14)
    }
}
