import SwiftUI

/// One day's timeline: an hour pill per hour with its + and totals, the entries under their hour, then the notes.
struct DayPage: View {
    let day: CalendarDay

    @Environment(FoodLogState.self) private var state
    @Observe(AppSettings.current) private var settings
    @Observe private var entries: [FoodEntry]
    @Observe private var notes: [FoodLogNote]

    init(day: CalendarDay) {
        self.day = day
        _entries = Observe(FoodEntry.on(day))
        _notes = Observe(FoodLogNote.on(day))
    }

    private var timeline: NutritionSettings.Timeline { settings.nutrition.timeline }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(FoodLog.hours(entries, timeline: timeline)) { hour in
                        HourRow(day: day, hour: hour, showsTotals: timeline.hourlyTotals)
                        ForEach(hour.rows) { row in
                            EntryRow(row: row, showsTime: timeline.foodTimestamps, hidesDetails: timeline.hideFoodDetails)
                        }
                    }
                }
                .background(alignment: .leading) {
                    Rectangle().fill(Theme.separator).frame(width: 1).padding(.leading, HourRow.gutter / 2)
                }
                NotesSection(day: day, notes: notes)
                    .padding(.top, 28)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .scrollIndicators(.hidden)
        .onChange(of: entries, initial: true) { publish() }
        .onChange(of: state.day) { publish() }
    }

    private func publish() {
        if state.day == day, state.entries != entries { state.entries = entries }
    }
}

/// The hour pill, its + (a paste button while pasting inline), and the hour's macro totals.
private struct HourRow: View {
    static let gutter: CGFloat = 58

    let day: CalendarDay
    let hour: TimelineHour
    let showsTotals: Bool

    @Environment(FoodLogState.self) private var state
    @Environment(LocalStore.self) private var store

    var body: some View {
        let label = NutritionFormat.hour(hour.hour)
        let isCurrent = day == .today && Calendar.current.component(.hour, from: .now) == hour.hour
        let isSelected = state.selecting && hour.rows.contains { state.selection.contains($0.id) }
        HStack(spacing: 8) {
            HStack(spacing: 3) {
                Text(label)
                if isCurrent { Circle().frame(width: 4, height: 4) }
            }
            .font(AppFont.headline(11))
            .foregroundStyle(isSelected ? Theme.onPrimary : Theme.textPrimary)
            .padding(.horizontal, 8)
            .frame(height: 22)
            .background(isSelected ? Theme.textPrimary : Theme.surfaceRaised, in: Capsule())
            .frame(width: Self.gutter)
            addButton(label)
            Spacer(minLength: 8)
            if showsTotals, !hour.rows.isEmpty {
                HourTotals(amounts: hour.totals)
            }
        }
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private func addButton(_ label: String) -> some View {
        if let pending = state.pending, pending.inline {
            Button("Paste at \(label)", systemImage: "doc.on.clipboard.fill") {
                store.relocate(pending.entries, pending.action, to: .hour(day, hour: hour.hour))
                state.endSelection()
            }
            .labelStyle(.iconOnly)
            .font(.system(size: 11, weight: .bold))
            .frame(width: 24, height: 24)
            .background(Theme.textPrimary, in: Circle())
            .foregroundStyle(.black)
        } else {
            Button("Add food at \(label)", systemImage: "plus") { state.requestLog(minute: hour.hour * 60) }
                .labelStyle(.iconOnly)
                .font(.system(size: 11, weight: .bold))
                .frame(width: 24, height: 24)
                .background(Theme.surfaceRaised, in: Circle())
                .disabled(state.selecting)
        }
    }
}

/// "510 ઠ 33 P 18 F 56 C", each amount followed by its letter badge.
private struct HourTotals: View {
    let amounts: NutrientAmounts

    var body: some View {
        HStack(spacing: 10) {
            ForEach(NutrientID.macros, id: \.self) { id in
                HStack(spacing: 4) {
                    Text("\(Int((amounts[id] ?? 0).rounded()))").font(AppFont.medium(12)).monospacedDigit()
                    Group {
                        if id == .energy { calorieGlyph } else { Text(id.rawValue.uppercased()) }
                    }
                    .font(.system(size: 8, weight: .heavy))
                    .frame(width: 15, height: 15)
                    .background(Theme.surfaceRaised, in: Circle())
                }
            }
        }
        .foregroundStyle(Theme.textPrimary)
        .accessibilityElement(children: .combine)
    }
}

/// A food tile with its time, or its check circle in select mode, in the gutter.
private struct EntryRow: View {
    let row: TimelineRow
    let showsTime: Bool
    let hidesDetails: Bool

    @Environment(FoodLogState.self) private var state
    @Environment(LocalStore.self) private var store

    var body: some View {
        let entry = row.entry
        let isSelected = state.selection.contains(entry.id)
        HStack(spacing: 0) {
            ZStack {
                Color.clear
                if state.selecting {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 20))
                        .foregroundStyle(Theme.textPrimary)
                } else if showsTime, row.showsTime {
                    Text(NutritionFormat.time(entry.minute)).font(AppFont.caption(11)).foregroundStyle(Theme.textSecondary)
                }
            }
            .frame(width: HourRow.gutter)
            FoodTile(entry: entry, hidesDetails: hidesDetails, isSelecting: state.selecting)
                .onTapGesture { state.select(entry.id) }
                .contextMenu {
                    Button("Edit", systemImage: "pencil") { state.editing = entry }
                    Button("Duplicate", systemImage: "plus.square.on.square") {
                        store.log([entry.portion], on: entry.day, minute: entry.minute)
                    }
                    Button("Remove", systemImage: "trash", role: .destructive) { store.deleteEntries([entry.id]) }
                }
                .accessibilityAddTraits(isSelected ? .isSelected : [])
        }
        .padding(.bottom, 8)
    }
}

/// The icon, "Name By Brand", "200ઠ 12P 8F 20C • 1 portion", and the pencil that opens the editor.
struct FoodTile: View {
    let entry: FoodEntry
    var hidesDetails = false
    var isSelecting = false

    @Environment(FoodLogState.self) private var state

    var body: some View {
        HStack(spacing: 12) {
            FoodEntryIcon(food: entry.food)
            VStack(alignment: .leading, spacing: 3) {
                Text(entry.food.displayName).font(AppFont.headline(14)).lineLimit(2)
                if !hidesDetails {
                    let kcal = Int((entry.amounts[.energy] ?? 0).rounded())
                    Text("\(kcal)\(Text(calorieGlyph).font(.system(size: 9))) \(NutritionFormat.macros(entry.amounts)) · \(NutritionFormat.serving(entry.serving, of: entry.food))")
                        .font(AppFont.caption(12))
                        .foregroundStyle(Theme.textSecondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 4)
            Button("Edit \(entry.food.name)", systemImage: "pencil") { state.editing = entry }
                .labelStyle(.iconOnly)
                .font(.system(size: 13, weight: .semibold))
                .frame(width: 30, height: 30)
                .background(Theme.surfaceRaised, in: Circle())
                .disabled(isSelecting)
                .opacity(isSelecting ? 0.4 : 1)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
        .contentShape(RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(entry.food.displayName)
    }
}

/// The food's library icon, or a bolt for a quick add.
struct FoodEntryIcon: View {
    let food: FoodSnapshot

    var body: some View {
        if food.source == .quickAdd {
            Image(systemName: "bolt.fill")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.calories)
                .frame(width: 32, height: 32)
        } else {
            FoodIconView(name: food.icon, size: 32)
        }
    }
}

extension FoodSnapshot {
    /// "ZZ Test Food By ZZ Brand", as MacroFactor names branded foods.
    var displayName: String {
        guard let brand, !brand.isEmpty else { return name }
        return "\(name) By \(brand)"
    }
}

/// The day's notes, "n / 5", and the + that is off at the limit.
private struct NotesSection: View {
    let day: CalendarDay
    let notes: [FoodLogNote]

    @Environment(FoodLogState.self) private var state

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Notes").font(AppFont.title(18))
                Spacer()
                if !notes.isEmpty {
                    Text("\(notes.count) / \(FoodLogNote.limitPerDay)").font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                }
                Button("Add Note", systemImage: "plus") {
                    state.note = NoteDraft(note: FoodLogNote(day: day, minute: Date.now.minuteOfDay(), title: ""), isNew: true)
                }
                .labelStyle(.iconOnly)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.black)
                .frame(width: 28, height: 28)
                .background(Theme.textPrimary, in: Circle())
                .disabled(notes.count >= FoodLogNote.limitPerDay || state.selecting)
                .opacity(notes.count >= FoodLogNote.limitPerDay ? 0.4 : 1)
            }
            if notes.isEmpty {
                Text("No notes to display")
                    .font(AppFont.caption())
                    .foregroundStyle(Theme.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
            }
            ForEach(notes) { note in
                Button { state.note = NoteDraft(note: note, isNew: false) } label: { NoteCard(note: note) }
                    .buttonStyle(.plain)
                    .disabled(state.selecting)
            }
        }
    }
}

private struct NoteCard: View {
    let note: FoodLogNote

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(note.title).font(AppFont.headline(15))
            if !note.body.isEmpty {
                Text(note.body).font(AppFont.caption(14)).foregroundStyle(Theme.textSecondary).lineLimit(4)
            }
            HStack(spacing: 6) {
                Spacer()
                Text(NutritionFormat.clock(note.minute)).font(AppFont.caption(11)).foregroundStyle(Theme.textSecondary)
                Circle().fill(note.color.tint).frame(width: 6, height: 6)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
        .contentShape(Rectangle())
    }
}

extension FoodLogNote.Color {
    var tint: Color {
        switch self {
        case .red: Theme.destructive
        case .blue: Theme.calories
        case .green: Theme.carbs
        case .yellow: Theme.fat
        case .purple: Theme.vitamins
        }
    }

    var title: String { rawValue.capitalized }
}
