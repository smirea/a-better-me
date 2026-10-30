import SwiftUI

/// Ramble: say what you ate and the foods arrive one at a time as the server's model reads the words, each matched
/// against the logger's own search and the log. Every row can be checked, swapped for another option, re-weighed, or
/// removed, and nothing is logged until Add (docs/decisions/nutrition.md, Ramble logging).
struct RambleTab: View {
    let session: LoggerSession
    /// Opens a food row's detail to change its serving.
    let open: (RambleRow) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var saved = 0

    private var capture: RambleCapture { session.ramble }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 4) {
                    if capture.rows.isEmpty, capture.phase != .review {
                        hints.transition(.opacity)
                    }
                    ForEach(capture.rows, id: \.key) { row in
                        RambleRowView(row: row, capture: capture, open: { open(row) })
                            .id(row.key)
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
            .onChange(of: capture.rows.count) { old, new in
                guard new > old, let last = capture.rows.last else { return }
                withAnimation(.smooth) { proxy.scrollTo(last.key, anchor: .bottom) }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { footer }
        .animation(reduceMotion ? nil : .spring(duration: 0.42, bounce: 0.18), value: capture.rows)
        .animation(.snappy(duration: 0.25), value: capture.phase)
        .animation(.snappy(duration: 0.22), value: capture.expanded)
        .sensoryFeedback(trigger: capture.rows.count) { old, new in new > old ? .impact(weight: .light, intensity: 0.6) : nil }
        .sensoryFeedback(.success, trigger: saved)
        .task {
            if capture.phase == .idle { await capture.start() }
        }
        .onDisappear {
            Task { await capture.stop() }
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
            if capture.phase == .listening || capture.phase == .finishing, !capture.transcript.isEmpty {
                Text(Self.tail(capture.transcript))
                    .font(AppFont.caption(14))
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(2)
                    .truncationMode(.head)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .transition(.opacity)
                    .accessibilityLabel("Transcript, \(capture.transcript)")
            }
            if capture.phase == .listening {
                RambleWaveform(meter: capture.meter, active: true)
                    .frame(height: 40)
                    .transition(.opacity)
            }
            if capture.phase == .finishing {
                Label("Checking the recording", systemImage: "sparkles")
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
                    .buttonStyle(.glassProminent)
                    .tint(Theme.textPrimary)
                    .foregroundStyle(Theme.onPrimary)
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
            LinearGradient(stops: [.init(color: Theme.background.opacity(0), location: 0), .init(color: Theme.background, location: 0.35)], startPoint: .top, endPoint: .bottom)
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

    /// The last 140 characters, from a word's start.
    static func tail(_ text: String) -> String {
        guard text.count > 140 else { return text }
        let cut = text.suffix(140)
        guard let space = cut.firstIndex(of: " ") else { return "… " + cut }
        return "… " + cut[cut.index(after: space)...]
    }
}

private struct RambleRowView: View {
    let row: RambleRow
    let capture: RambleCapture
    let open: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// 1 just after the row arrived or changed, easing to 0.
    @State private var glow = 0.0
    /// What a correction replaced, struck through until it fades.
    @State private var was: String?

    /// What the row says; a change to it is a correction worth showing.
    private struct Face: Equatable {
        var title: String
        var detail: String
        var placement: String
    }

    private var face: Face {
        let placement = "\(row.day) \(row.minute ?? -1) \(row.item.meal?.title ?? "")"
        return switch row.content {
        case let .food(food): Face(title: food.pick.portion.food.displayName, detail: NutritionFormat.serving(food.pick.portion.serving), placement: placement)
        case let .copy(copy): Face(title: Self.title(copy), detail: copy.entries.map(\.food.name).joined(separator: " · "), placement: placement)
        case .unmatched: Face(title: row.item.name, detail: "", placement: placement)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 12) {
                main
                if capture.phase != .listening {
                    Button("Remove", systemImage: "minus.circle") { capture.remove(row) }
                        .labelStyle(.iconOnly)
                        .foregroundStyle(Theme.textSecondary)
                        .frame(width: 44, height: 44)
                        .buttonStyle(.plain)
                        .transition(.opacity)
                }
            }
            if case let .food(food) = row.content, food.options.count > 1 {
                options(food)
            }
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 10)
        .background {
            let shape = RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
            shape.fill(Theme.surface)
                .overlay { shape.fill(Theme.accent.opacity(0.16 * glow)) }
                .overlay { shape.strokeBorder(Theme.accent.opacity(0.7 * glow), lineWidth: 1) }
                .overlay { if capture.phase == .finishing { Sheen().clipShape(shape) } }
        }
        .scaleEffect(reduceMotion ? 1 : 1 + 0.012 * glow)
        // Rows coming back into view after a tab switch are not new.
        .onAppear { if capture.phase == .listening || capture.phase == .finishing { light() } }
        .onChange(of: face) { old, new in
            if old.title != new.title {
                was = old.title
            } else if old.detail != new.detail, !old.detail.isEmpty {
                was = old.detail
            }
            light()
        }
        .task(id: was) {
            guard was != nil else { return }
            try? await Task.sleep(for: .seconds(2.2))
            withAnimation(.easeOut(duration: 0.4)) { was = nil }
        }
        .sensoryFeedback(.selection, trigger: face)
        .contextMenu {
            Button("Remove", systemImage: "trash", role: .destructive) { capture.remove(row) }
        }
    }

    @ViewBuilder private var main: some View {
        switch row.content {
        case let .food(food):
            Button(action: open) {
                HStack(spacing: 12) {
                    FoodIcon(food: food.pick.portion.food)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(food.pick.portion.food.displayName).font(AppFont.rowTitle).lineLimit(1)
                            .contentTransition(.interpolate)
                        corrected
                        Text("\(Text(macroLine: food.pick.portion.amounts)) · \(NutritionFormat.serving(food.pick.portion.serving))")
                            .font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary).lineLimit(1)
                            .contentTransition(.numericText())
                        placement
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityHint("Changes the serving")
        case let .copy(copy):
            HStack(spacing: 12) {
                Image(systemName: "square.on.square")
                    .font(.system(size: 14, weight: .semibold))
                    .frame(width: 28, height: 28)
                    .background(Theme.surfaceRaised, in: .circle)
                VStack(alignment: .leading, spacing: 2) {
                    Text(Self.title(copy)).font(AppFont.rowTitle).lineLimit(1)
                    corrected
                    Text(copy.entries.map(\.food.name).joined(separator: " · "))
                        .font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary).lineLimit(2)
                    let total = copy.entries.reduce(into: NutrientAmounts()) { $0 = $0 + $1.amounts }
                    Text("\(Text(macroLine: total)) · \(copy.entries.count == 1 ? "1 food" : "\(copy.entries.count) foods")")
                        .font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary).lineLimit(1)
                    placement
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .accessibilityElement(children: .combine)
        case .unmatched:
            VStack(alignment: .leading, spacing: 2) {
                Text(row.item.name.isEmpty ? "A meal" : row.item.name).font(AppFont.rowTitle).lineLimit(1)
                corrected
                Text("Nothing matched. Add it from Search.").font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
            }
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        }
    }

    /// The words a correction replaced, struck through.
    @ViewBuilder private var corrected: some View {
        if let was {
            Text(was)
                .font(AppFont.rowDetail)
                .strikethrough(color: Theme.accent)
                .foregroundStyle(Theme.textTertiary)
                .lineLimit(1)
                .transition(.opacity.combined(with: .move(edge: .top)))
                .accessibilityLabel("Was \(was)")
        }
    }

    private static func title(_ copy: RambleRow.Copy) -> String {
        "\(NutritionFormat.dayTitle(copy.meal.day))'s \(copy.meal.meal.title)"
    }

    private func light() {
        glow = 1
        withAnimation(.easeOut(duration: 1.6)) { glow = 0 }
    }

    /// When it is logged, unless that is just now today.
    @ViewBuilder private var placement: some View {
        let today = CalendarDay.today
        if row.day != today || row.item.minute != nil || row.item.meal != nil {
            let day = NutritionFormat.dayTitle(row.day, today: today)
            let time = row.minute.map(NutritionFormat.clock) ?? "at their times"
            let meal = row.item.meal.map { "\($0.title) · " } ?? ""
            Text("\(day) · \(meal)\(time)")
                .font(AppFont.badge)
                .foregroundStyle(Theme.accent)
                .lineLimit(1)
        }
    }

    @ViewBuilder private func options(_ food: RambleRow.Food) -> some View {
        let all = capture.showsAllOptions(row)
        Button {
            capture.toggleOptions(row)
        } label: {
            HStack(spacing: 4) {
                Text(all ? "Hide options" : "\(food.options.count) options")
                Image(systemName: "chevron.down").rotationEffect(.degrees(all ? 180 : 0))
            }
            .font(AppFont.badge)
            .foregroundStyle(Theme.textSecondary)
            .padding(.horizontal, 10)
            .frame(height: 26)
            .background(Theme.surfaceRaised, in: .capsule)
            .frame(minHeight: 32)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .padding(.leading, 40)
        if all {
            VStack(spacing: 0) {
                ForEach(food.options) { option in
                    Button {
                        capture.pick(option, in: row)
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: option.key == food.key ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(option.key == food.key ? Theme.textPrimary : Theme.textTertiary)
                            FoodRow(food: option.portion.food, serving: option.portion.serving)
                        }
                        .frame(minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(option.key == food.key ? .isSelected : [])
                }
            }
            .padding(.leading, 40)
            .transition(.opacity)
        }
    }
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

/// A band of light passing over a row while the final read checks it.
private struct Sheen: View {
    @State private var at = -1.0

    var body: some View {
        GeometryReader { proxy in
            LinearGradient(colors: [.clear, Theme.accent.opacity(0.14), .clear], startPoint: .leading, endPoint: .trailing)
                .frame(width: proxy.size.width * 0.5)
                .offset(x: at * proxy.size.width)
        }
        .allowsHitTesting(false)
        .onAppear {
            withAnimation(.easeInOut(duration: 1.3).repeatForever(autoreverses: false)) { at = 1.5 }
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
