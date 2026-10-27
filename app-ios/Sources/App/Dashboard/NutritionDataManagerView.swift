import SwiftUI

/// MacroFactor's Nutrition Data Manager: every day with intake or a mark, newest month first. Its entry sheet writes the
/// day's `nutrition_days` row: entered totals replace the log's, and a fasted or incomplete mark changes what the
/// expenditure counts.
struct NutritionDataManagerView: View {
    @Environment(NutritionData.self) private var nutrition
    @State private var editing: EditedLogDay?

    var body: some View {
        let log = nutrition.log
        let calendar = Calendar.current
        let months = Dictionary(grouping: log.reversed()) { CalendarDay(calendar.dateInterval(of: .month, for: $0.day.date(in: calendar))!.start, in: calendar) }
        List {
            if log.isEmpty {
                ContentUnavailableView("No Nutrition Data", systemImage: "cylinder.split.1x2", description: Text("Days you log foods or enter totals for appear here."))
                    .listRowBackground(Color.clear)
            }
            ForEach(months.keys.sorted(by: >), id: \.self) { month in
                ThemedSection(month.date(in: calendar).formatted(.dateTime.month(.wide).year())) {
                    ForEach(months[month]!, id: \.day) { day in
                        row(day, calendar: calendar)
                    }
                }
            }
        }
        .themedList()
        .detailTitle("Nutrition Data Manager")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Add Day", systemImage: "plus") { editing = EditedLogDay(day: .today) }
            }
        }
        .sheet(item: $editing) { NutritionDayEntrySheet(day: $0.day, log: nutrition.log) }
    }

    private func row(_ day: NutritionLogDay, calendar: Calendar) -> some View {
        Button { editing = EditedLogDay(day: day.day) } label: {
            HStack {
                RowLabel(
                    title: day.entryCount > 0 || day.hasOverride ? "\((day.consumed[.energy] ?? 0).wholeText) kcal" : "No intake",
                    detail: [day.day.date(in: calendar).formatted(.dateTime.weekday().month().day().year()), day.status.label].compactMap { $0 }.joined(separator: " · "),
                    systemImage: day.hasOverride ? "square.and.pencil" : day.entryCount > 0 ? "fork.knife" : "moon.zzz"
                )
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

/// The Nutrition entry: a day's energy and macros, "Are you fasting?", and "Is this day incomplete?". With every field
/// empty the log stays in charge; once one is filled, the override is the log's totals with the filled amounts on top,
/// so an empty field keeps the logged amount its placeholder shows.
struct NutritionDayEntrySheet: View {
    let log: [NutritionLogDay]

    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var date: Date
    @State private var fields: [NutrientID: Double] = [:]
    @State private var fasting = false
    @State private var incomplete = false

    init(day: CalendarDay, log: [NutritionLogDay]) {
        self.log = log
        _date = State(initialValue: day.date(in: .current))
    }

    private var day: CalendarDay { CalendarDay(date) }
    private var existing: NutritionLogDay? { log.first { $0.day == day } }

    private var amounts: NutrientAmounts {
        fields.filter { $0.value >= 0 }
    }

    var body: some View {
        NavigationStack {
            Form {
                ThemedSection {
                    DatePicker("Date", selection: $date, in: ...Date.now, displayedComponents: .date)
                }
                ThemedSection("Nutrition") {
                    ForEach(NutritionMetrics.macros, id: \.self) { id in
                        HStack {
                            Text(id == .energy ? "Energy" : id.dashboardLabel)
                            TextField(placeholder(id), value: Binding(get: { fields[id] }, set: { fields[id] = $0 }), format: .number.precision(.fractionLength(0...1)).grouping(.never))
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                                .accessibilityLabel("\(id == .energy ? "Energy" : id.dashboardLabel) in \(id == .energy ? "kcal" : "grams")")
                            Text(id == .energy ? "kcal" : "g").foregroundStyle(Theme.textSecondary)
                        }
                    }
                }
                ThemedSection(footer: "A fasting day counts as zero calories while nothing is logged. An incomplete day is left out of your expenditure.") {
                    Toggle("Are you fasting?", isOn: $fasting).tint(Theme.accent)
                    Toggle("Is this day incomplete?", isOn: $incomplete).tint(Theme.accent)
                }
            }
            .themedList()
            .navigationTitle("Nutrition")
            .navigationSubtitle(date.formatted(.dateTime.weekday().month().day()))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .confirm) { save() }
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
        return (existing.consumed[id] ?? 0).wholeText
    }

    private func load() {
        let override = existing.flatMap { $0.hasOverride ? $0.consumed : nil }
        fields = Dictionary(uniqueKeysWithValues: NutritionMetrics.macros.compactMap { id in override?[id].map { (id, $0) } })
        fasting = existing?.status == .fasted
        incomplete = existing?.status == .partial
    }

    private func save() {
        let filled = amounts
        let logged = existing.map { $0.hasOverride ? [:] : $0.consumed } ?? [:]
        let amounts = filled.isEmpty ? filled : logged.merging(filled) { $1 }
        let status: NutritionDay.Status = fasting ? .fasted : incomplete ? .partial : .none
        store.updateDay(day) { row in
            row.override = amounts.isEmpty ? nil : amounts
            row.status = status
        }
        dismiss()
    }
}
