import SwiftUI

/// MacroFactor's Nutrition Data Manager: every day with intake or a mark, newest month first. Its entry sheet writes the
/// day's `nutrition_days` row: entered totals replace the log's, and a fasted or incomplete mark changes what the
/// expenditure counts.
struct NutritionDataManagerView: View {
    @Observe(NutritionLogDay.all) private var log
    @State private var editing: EditedLogDay?

    var body: some View {
        let calendar = Calendar.current
        let months = Dictionary(grouping: log.reversed()) { CalendarDay(calendar.dateInterval(of: .month, for: $0.day.date(in: calendar))!.start, in: calendar) }
        List {
            if log.isEmpty {
                ContentUnavailableView("No Nutrition Data", systemImage: "cylinder.split.1x2", description: Text("Days you log foods or enter totals for appear here."))
                    .listRowBackground(Color.clear)
            }
            ForEach(months.keys.sorted(by: >), id: \.self) { month in
                Section {
                    ForEach(months[month]!, id: \.day) { day in
                        row(day, calendar: calendar)
                    }
                } header: {
                    Text(month.date(in: calendar).formatted(.dateTime.month(.wide).year())).font(AppFont.title()).foregroundStyle(Theme.textPrimary)
                }
                .listRowBackground(Theme.surface)
            }
        }
        .themedList()
        .navigationTitle("Nutrition Data Manager")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Add Day", systemImage: "plus") { editing = EditedLogDay(day: .today) }
            }
        }
        .sheet(item: $editing) { NutritionDayEntrySheet(day: $0.day, log: log) }
    }

    private func row(_ day: NutritionLogDay, calendar: Calendar) -> some View {
        Button { editing = EditedLogDay(day: day.day) } label: {
            HStack(spacing: 14) {
                Image(systemName: day.hasOverride ? "square.and.pencil" : day.entryCount > 0 ? "fork.knife" : "moon.zzz")
                    .frame(width: 24)
                    .foregroundStyle(Theme.textSecondary)
                VStack(alignment: .leading, spacing: 2) {
                    Text(day.entryCount > 0 || day.hasOverride ? "\(Int((day.consumed[.energy] ?? 0).rounded()).formatted()) kcal" : "No intake")
                        .font(AppFont.headline(15))
                    Text([day.day.date(in: calendar).formatted(.dateTime.weekday().month().day().year()), day.status.label].compactMap { $0 }.joined(separator: " · "))
                        .font(AppFont.caption(13))
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                Image(systemName: "pencil")
                    .font(.footnote.weight(.semibold))
                    .frame(width: 30, height: 30)
                    .background(Theme.surfaceRaised, in: .circle)
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Edit \(day.day.date(in: calendar).formatted(.dateTime.month(.wide).day()))")
    }
}

private struct EditedLogDay: Identifiable {
    var day: CalendarDay
    var id: CalendarDay { day }
}

extension NutritionDay.Status {
    var label: String? {
        switch self {
        case .none: nil
        case .partial: "Incomplete"
        case .fasted: "Fasted"
        }
    }
}

/// The Nutrition entry: a day's energy and macros, "Are you fasting?", and "Is this day incomplete?". Empty fields leave
/// the logged totals in charge, which the fields show as placeholders.
struct NutritionDayEntrySheet: View {
    let log: [NutritionLogDay]

    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var date: Date
    @State private var fields: [NutrientID: String] = [:]
    @State private var fasting = false
    @State private var incomplete = false

    init(day: CalendarDay, log: [NutritionLogDay]) {
        self.log = log
        _date = State(initialValue: day.date(in: .current))
    }

    private var day: CalendarDay { CalendarDay(date) }
    private var existing: NutritionLogDay? { log.first { $0.day == day } }

    private var amounts: NutrientAmounts {
        fields.compactMapValues { Double($0.replacing(",", with: ".")).flatMap { $0 >= 0 ? $0 : nil } }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Date", selection: $date, in: ...Date.now, displayedComponents: .date)
                }
                .listRowBackground(Theme.surface)
                Section("Nutrition") {
                    ForEach(NutritionMetrics.macros, id: \.self) { id in
                        HStack {
                            Text(id == .energy ? "Energy" : id.dashboardLabel)
                            TextField(placeholder(id), text: Binding(get: { fields[id] ?? "" }, set: { fields[id] = $0 }))
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                                .accessibilityLabel("\(id == .energy ? "Energy" : id.dashboardLabel) in \(id == .energy ? "kcal" : "grams")")
                            Text(id == .energy ? "kcal" : "g").foregroundStyle(Theme.textSecondary)
                        }
                    }
                }
                .listRowBackground(Theme.surface)
                Section {
                    Toggle("Are you fasting?", isOn: $fasting).tint(Theme.accent)
                    Toggle("Is this day incomplete?", isOn: $incomplete).tint(Theme.accent)
                } footer: {
                    Text("A fasting day counts as zero calories while nothing is logged. An incomplete day is left out of your expenditure.")
                }
                .listRowBackground(Theme.surface)
            }
            .themedList()
            .navigationTitle("Nutrition")
            .navigationSubtitle(date.formatted(.dateTime.weekday().month().day()))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", systemImage: "xmark") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", systemImage: "checkmark") { save() }
                }
                ToolbarItem(placement: .bottomBar) {
                    Button("Clear Day", systemImage: "trash", role: .destructive) {
                        store.delete(NutritionDay.self, id: day)
                        dismiss()
                    }
                    .disabled(existing.map { !$0.hasOverride && $0.status == .none } ?? true)
                }
            }
            .onChange(of: fasting) { _, on in if on { incomplete = false } }
            .onChange(of: incomplete) { _, on in if on { fasting = false } }
            .onChange(of: day, initial: true) { _, _ in load() }
        }
    }

    private func placeholder(_ id: NutrientID) -> String {
        guard let existing, existing.entryCount > 0, !existing.hasOverride else { return "" }
        return Int((existing.consumed[id] ?? 0).rounded()).formatted()
    }

    private func load() {
        let override = existing.flatMap { $0.hasOverride ? $0.consumed : nil }
        fields = Dictionary(uniqueKeysWithValues: NutritionMetrics.macros.compactMap { id in
            override?[id].map { (id, $0.formatted(.number.precision(.fractionLength(0...1)).grouping(.never))) }
        })
        fasting = existing?.status == .fasted
        incomplete = existing?.status == .partial
    }

    private func save() {
        let amounts = amounts
        let status: NutritionDay.Status = fasting ? .fasted : incomplete ? .partial : .none
        store.updateDay(day) { row in
            row.override = amounts.isEmpty ? nil : amounts
            row.status = status
        }
        dismiss()
    }
}
