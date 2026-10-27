import SwiftUI

/// The bar under the timeline: the search field, or in select mode the selection's actions, or a copy or move's
/// targets.
struct FoodLogBottomBar: View {
    @Environment(FoodLogState.self) private var state

    var body: some View {
        GlassEffectContainer {
            if let pending = state.pending {
                PasteBar(pending: pending)
            } else if state.selecting {
                SelectionBar()
            } else {
                SearchBar()
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 8)
    }
}

/// "Search for a food" with a barcode button, and the round Your Foods button: each opens the logger.
private struct SearchBar: View {
    @Environment(FoodLogState.self) private var state

    var body: some View {
        HStack(spacing: 10) {
            HStack(spacing: 10) {
                Button { state.requestLog() } label: {
                    Label("Search for a food", systemImage: "magnifyingglass")
                        .foregroundStyle(Theme.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                }
                Button("Scan a barcode", systemImage: "barcode.viewfinder") { state.requestLog(start: .barcode) }
                    .labelStyle(.iconOnly)
            }
            .padding(.horizontal, 16)
            .frame(height: 48)
            .glassEffect(.regular.interactive(), in: .capsule)
            Button("Your Foods", systemImage: "books.vertical.fill") { state.requestLog(start: .library) }
                .labelStyle(.iconOnly)
                .frame(width: 48, height: 48)
                .glassEffect(.regular.interactive(), in: .circle)
        }
        .buttonStyle(.plain)
    }
}

/// "✕ Select · N Foods" and what can be done with the selection.
private struct SelectionBar: View {
    private enum Prompt: Identifiable {
        case timestamp

        var id: Self { self }
    }

    @Environment(FoodLogState.self) private var state
    @Environment(LocalStore.self) private var store
    @State private var confirmingRemove = false
    @State private var prompt: Prompt?

    var body: some View {
        let count = state.selection.count
        HStack(spacing: 10) {
            BarTitle(title: "Select", count: count, systemImage: "xmark") { state.endSelection() }
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    if count == 1 {
                        Button("Edit") { state.editing = state.selectedEntries.first }
                    }
                    Button("Copy") { state.pending = .init(action: .copy, entries: state.selectedEntries) }
                    Button("Move") { state.pending = .init(action: .move, entries: state.selectedEntries) }
                    Button("Remove") { confirmingRemove = true }
                    Button("Modify Timestamp") { prompt = .timestamp }
                }
                .buttonStyle(.glass)
                .font(AppFont.medium(14))
                .disabled(count == 0)
            }
            .scrollIndicators(.hidden)
        }
        .alert("Remove Foods", isPresented: $confirmingRemove) {
            Button("Remove", role: .destructive) {
                store.deleteEntries(Array(state.selection))
                state.endSelection()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("\(count) food \(count == 1 ? "entry" : "entries") will be removed from the timeline. Are you sure you want to continue? This action cannot be undone.")
        }
        .sheet(item: $prompt) { _ in
            let entries = state.selectedEntries
            TimePrompt(title: "Modify Timestamp", day: state.day, minute: entries.first?.minute ?? 720, showsDate: false) { day, minute in
                store.moveEntries(entries.map(\.id), to: day, minute: minute)
                state.endSelection()
            }
        }
    }
}

/// Copy or Move's targets. Paste Inline turns every hour's + into a paste button, on any day the owner swipes to.
private struct PasteBar: View {
    private enum Prompt: Identifiable {
        case dateTime, dates

        var id: Self { self }
    }

    let pending: FoodLogState.Pending

    @Environment(FoodLogState.self) private var state
    @Environment(LocalStore.self) private var store
    @State private var prompt: Prompt?

    var body: some View {
        let title = pending.action == .copy ? "Copy" : "Move"
        HStack(spacing: 10) {
            BarTitle(title: title, count: pending.entries.count, systemImage: "chevron.left") {
                if pending.inline { state.pending?.inline = false } else { state.pending = nil }
            }
            if pending.inline {
                Text("Tap an hour to paste").font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                Spacer()
            } else {
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        Button("To Now") { paste(.now) }
                        Button("To Today") { paste(.today) }
                        Button("To Tomorrow") { paste(.tomorrow) }
                        if pending.action == .copy {
                            Button("To Dates") { prompt = .dates }
                        }
                        Button("To Date & Time") { prompt = .dateTime }
                        Button("Paste Inline") { state.pending?.inline = true }
                    }
                    .buttonStyle(.glass)
                    .font(AppFont.medium(14))
                }
                .scrollIndicators(.hidden)
            }
        }
        .sheet(item: $prompt) { prompt in
            switch prompt {
            case .dateTime:
                TimePrompt(title: "\(title) to Date & Time", day: state.day, minute: pending.entries.first?.minute ?? 720, showsDate: true) { day, minute in
                    paste(.dateTime(day, minute: minute))
                }
            case .dates:
                DatesPrompt { paste(.days($0)) }
            }
        }
    }

    private func paste(_ target: PasteTarget) {
        store.relocate(pending.entries, pending.action, to: target)
        state.endSelection()
    }
}

private struct BarTitle: View {
    let title: String
    let count: Int
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: systemImage)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.black)
                    .frame(width: 26, height: 26)
                    .background(Theme.textPrimary, in: Circle())
                VStack(alignment: .leading, spacing: 0) {
                    Text(title).font(AppFont.headline(13))
                    Text("\(count) \(count == 1 ? "Food" : "Foods")").font(AppFont.caption(11)).foregroundStyle(Theme.textSecondary)
                }
            }
            .padding(.leading, 6)
            .padding(.trailing, 12)
            .frame(height: 44)
            .glassEffect(.regular.interactive(), in: .capsule)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(systemImage == "xmark" ? "End selection" : "Back")
    }
}

/// A time, and optionally a day, for Modify Timestamp and To Date & Time.
private struct TimePrompt: View {
    let title: String
    let showsDate: Bool
    let onDone: (CalendarDay, Int) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var date: Date

    init(title: String, day: CalendarDay, minute: Int, showsDate: Bool, onDone: @escaping (CalendarDay, Int) -> Void) {
        self.title = title
        self.showsDate = showsDate
        self.onDone = onDone
        _date = State(initialValue: Calendar.current.date(bySettingHour: minute / 60, minute: minute % 60, second: 0, of: day.date)!)
    }

    var body: some View {
        NavigationStack {
            VStack {
                if showsDate {
                    DatePicker("Date", selection: $date, displayedComponents: .date).datePickerStyle(.graphical)
                }
                if showsDate {
                    DatePicker("Time", selection: $date, displayedComponents: .hourAndMinute)
                } else {
                    DatePicker("Time", selection: $date, displayedComponents: .hourAndMinute)
                        .datePickerStyle(.wheel)
                        .labelsHidden()
                }
            }
            .padding(.horizontal, 20)
            .detailTitle(title)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(role: .cancel) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .confirm) {
                        let parts = Calendar.current.dateComponents([.hour, .minute], from: date)
                        onDone(CalendarDay(date), parts.hour! * 60 + parts.minute!)
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents(showsDate ? [.large] : [.height(320)])
    }
}

/// To Dates: several days at once, each copy keeping its time.
private struct DatesPrompt: View {
    let onDone: ([CalendarDay]) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var dates: Set<DateComponents> = []

    var body: some View {
        NavigationStack {
            MultiDatePicker("Dates", selection: $dates)
                .padding(.horizontal, 20)
                .detailTitle("Copy to Dates")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button(role: .cancel) { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button(role: .confirm) {
                            onDone(dates.compactMap { Calendar.current.date(from: $0) }.map { CalendarDay($0) })
                            dismiss()
                        }
                        .disabled(dates.isEmpty)
                    }
                }
        }
        .presentationDetents([.large])
    }
}

/// The ⋮ menu: Nutrition Overview, Copy Day, Select All, Clear Day, the day's status, and the tile and hour toggles.
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
        Menu("More", systemImage: "ellipsis") {
            Button("Nutrition Overview", systemImage: "list.bullet.rectangle") { state.path.append(.overview(day)) }
            Button("Copy Day", systemImage: "doc.on.doc") {
                state.selecting = true
                state.selection = Set(entries.map(\.id))
                state.pending = .init(action: .copy, entries: entries)
            }
            .disabled(entries.isEmpty)
            Button("Select All", systemImage: "checkmark.circle") {
                state.selecting = true
                state.selection = Set(entries.map(\.id))
            }
            .disabled(entries.isEmpty)
            Button("Clear Day", systemImage: "trash", role: .destructive) { confirmingClear = true }
                .disabled(entries.isEmpty)
            Picker("Day Status", systemImage: "flag", selection: Binding(get: { row.status }, set: { status in
                store.updateDay(day) { $0.status = status }
            })) {
                Text("Complete").tag(NutritionDay.Status.none)
                Text("Incomplete").tag(NutritionDay.Status.partial)
                Text("Fasted").tag(NutritionDay.Status.fasted)
            }
            .pickerStyle(.menu)
            Section {
                Toggle("Hide Food Details", systemImage: "chevron.up.circle", isOn: store.binding(settings, \.nutrition.timeline.hideFoodDetails))
                Toggle("Hide Empty Hours", systemImage: "hourglass", isOn: store.binding(settings, \.nutrition.timeline.hideEmptyHours))
            }
        }
        .alert("Clear Day", isPresented: $confirmingClear) {
            Button("Clear", role: .destructive) { store.deleteEntries(entries.map(\.id)) }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("\(entries.count) food \(entries.count == 1 ? "entry" : "entries") will be removed from the timeline. This action cannot be undone.")
        }
    }
}
