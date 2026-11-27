import Feedback
import SwiftUI

/// The selection's row of actions over the tab bar, and the notice of what was just copied, moved, or removed. Its height
/// is the timeline's bottom inset, so the last row scrolls clear of it.
struct FoodLogBottomBar: View {
    @Environment(FoodLogState.self) private var state

    var body: some View {
        GlassEffectContainer {
            VStack(alignment: .leading, spacing: 8) {
                if let notice = state.notice {
                    NoticeBar(notice: notice)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                if state.selecting {
                    SelectionBar()
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Theme.margin)
        .padding(.bottom, 8)
        // The day pages scroll inside the pager, out of reach of a bar's scroll edge effect, so the timeline fades
        // out here instead; hour pills showing through the glass buttons made the selection's actions hard to read.
        .background {
            if state.selecting {
                LinearGradient(colors: [Theme.background.opacity(0), Theme.background], startPoint: .top, endPoint: UnitPoint(x: 0.5, y: 0.2))
                    .padding(.top, -24)
                    .ignoresSafeArea(edges: .bottom)
                    .allowsHitTesting(false)
            }
        }
        .sensoryFeedback(.selection, trigger: state.selected.count)
        .animation(.snappy, value: state.notice)
        .animation(.snappy, value: state.selecting)
        .feedback(self)
    }
}

/// "Copied 3 foods to Today · Undo". It leaves after a few seconds, or when replaced by the next.
private struct NoticeBar: View {
    let notice: FoodLogState.Notice

    @Environment(FoodLogState.self) private var state
    @Environment(LocalStore.self) private var store

    var body: some View {
        HStack(spacing: 12) {
            Text(notice.message).font(AppFont.chip).lineLimit(2)
            Spacer(minLength: 0)
            if notice.undo != nil {
                Button("Undo") { state.undo(in: store) }
                    .font(AppFont.headline(14))
                    .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 18)
        .frame(minHeight: 44)
        .glassEffect(.regular, in: .capsule)
        .task(id: notice.id) {
            try? await Task.sleep(for: .seconds(5))
            if state.notice?.id == notice.id { state.notice = nil }
        }
        .feedback(self)
    }
}

/// One row: Copy, Move, and what fits the selection, with the trash at the end. Copy or Move turns the row into its
/// destinations, to Today and to Now, while every hour on any day pastes there too; the tab bar's ✕ steps back.
/// Today is left out when every food is already on it, where it would only duplicate them in place.
private struct SelectionBar: View {
    @Environment(FoodLogState.self) private var state
    @Environment(LocalStore.self) private var store

    var body: some View {
        let entries = state.selectedEntries
        let icons = CarriedIcons(entries: entries)
        HStack(alignment: .top, spacing: 8) {
            FlowLayout {
                Group {
                    if let action = state.action {
                        if !entries.allSatisfy({ $0.day == .today }) {
                            Button { state.paste(action, to: .today, in: store) } label: { icons.label("\(action.title) to Today") }
                        }
                        Button { state.paste(action, to: .now, in: store) } label: { icons.label("\(action.title) to Now") }
                    } else {
                        Button { state.action = .copy } label: { icons.label("Copy") }
                        Button { state.action = .move } label: { icons.label("Move") }
                        if entries.count > 1 {
                            Button("+ Recipe") { state.createRecipe() }
                                .accessibilityLabel("Create Recipe")
                        }
                        if entries.count == 1, let entry = entries.first {
                            Button("Edit") { state.editing = entry }
                            if entry.food.source == .recipe {
                                Button("Explode") {
                                    state.explode(entry.id, in: store)
                                    state.endSelection()
                                }
                            }
                        }
                    }
                }
                .chipButton()
            }
            Spacer(minLength: 0)
            if state.action == nil {
                Button("Remove", systemImage: "trash") { state.remove(entries, in: store) }
                    .labelStyle(.iconOnly)
                    .chipButton()
                    .buttonBorderShape(.circle)
            }
        }
        .feedback(self)
    }
}

/// The foods a Copy or Move carries, as their icons stacked at the button's bottom right: up to three distinct ones,
/// each tucked under the last.
private struct CarriedIcons {
    let emojis: [String?]
    let sources: [FoodSource]
    let count: Int

    init(entries: [FoodEntry]) {
        var seen: Set<String> = []
        var emojis: [String?] = []
        var sources: [FoodSource] = []
        for entry in entries {
            let emoji = FoodIconChoice.emoji(icon: entry.food.icon, name: entry.food.name)
            guard seen.insert(emoji ?? entry.food.source.rawValue).inserted else { continue }
            emojis.append(emoji)
            sources.append(entry.food.source)
            if emojis.count == 3 { break }
        }
        self.emojis = emojis
        self.sources = sources
        count = entries.count
    }

    func label(_ title: String) -> some View {
        HStack(alignment: .bottom, spacing: 6) {
            Text(title)
            HStack(spacing: -7) {
                ForEach(emojis.indices, id: \.self) { index in
                    FoodIcon(emoji: emojis[index], source: sources[index], size: 16)
                        .zIndex(Double(-index))
                }
            }
            .offset(y: 4)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(title), \(count) \(count == 1 ? "food" : "foods")")
    }
}

struct DayMenu: View {
    let day: CalendarDay

    @Environment(FoodLogState.self) private var state
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings
    @Observe private var entries: [FoodEntry]
    @Observe private var row: NutritionDay
    @State private var confirmingClear = false

    init(day: CalendarDay) {
        self.day = day
        _entries = Observe(FoodEntry.on(day))
        _row = Observe(NutritionDay.one(day))
    }

    var body: some View {
        Menu {
            Button("Nutrition Overview", systemImage: "list.bullet.rectangle") { state.path.append(FoodLogRoute.overview(day)) }
            Button("Strategy", systemImage: "chart.line.uptrend.xyaxis") { state.path.append(FoodLogRoute.strategy) }
            Button("Supplements", systemImage: "pills") { state.path.append(SupplementRoute.library) }
            Button("Copy Day", systemImage: "doc.on.doc") { state.copy(entries) }
            .disabled(entries.isEmpty)
            Button("Select All", systemImage: "checkmark.circle") { state.select(entries) }
            .disabled(entries.isEmpty)
            Button("Clear Day", systemImage: "trash", role: .destructive) { confirmingClear = true }
                .disabled(entries.isEmpty)
            Picker("Day Status", systemImage: "flag", selection: Binding(get: { row.status }, set: { status in
                store.updateDay(day) { $0.status = status }
            })) {
                ForEach(NutritionDay.Status.allCases, id: \.self) { Label($0.title, systemImage: $0.symbol).tag($0) }
            }
            .pickerStyle(.menu)
            Section {
                Toggle("Hide Food Details", systemImage: "chevron.up.circle", isOn: store.binding(settings, \.nutrition.timeline.hideFoodDetails))
                Toggle(settings.nutrition.timeline.display == .sections ? "Hide Empty Sections" : "Hide Empty Hours", systemImage: "hourglass", isOn: store.binding(settings, \.nutrition.timeline.hideEmptyHours))
                Picker("Display", systemImage: "list.bullet.indent", selection: store.binding(settings, \.nutrition.timeline.display)) {
                    ForEach(NutritionSettings.Timeline.Display.allCases, id: \.self) { Text($0.title).tag($0) }
                }
                .pickerStyle(.menu)
            }
        } label: {
            // Inside the label, so the whole circle opens the menu, not just the glyph.
            Label("Day Options", systemImage: "ellipsis").labelStyle(.iconOnly).frame(width: 48, height: 48).contentShape(.circle)
        }
        .alert("Clear Day", isPresented: $confirmingClear) {
            Button("Clear", role: .destructive) { store.deleteEntries(entries.map(\.id)) }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("\(entries.count) food \(entries.count == 1 ? "entry" : "entries") will be removed from the timeline.")
        }
    }
}
