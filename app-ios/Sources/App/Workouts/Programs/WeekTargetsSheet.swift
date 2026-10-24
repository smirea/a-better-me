import SwiftUI

/// The targets of one exercise in one week card: `SetTargetsSheet` with Skip Exercise, Save To All Weeks, Save, and More
/// Options. The deload card opens read-only, because the deload derives from the week next to it.
struct WeekTargetsSheet: View {
    let program: Program
    let item: BlockExercise
    let card: WeekCard
    let dayName: String
    let onApply: (WeekTargetsEdit, SavingScope) -> Void

    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(\.dismiss) private var dismiss
    @State private var skip: Bool
    @State private var savingOptions: [WorkoutSet]?

    init(program: Program, item: BlockExercise, card: WeekCard, dayName: String, onApply: @escaping (WeekTargetsEdit, SavingScope) -> Void) {
        self.program = program
        self.item = item
        self.card = card
        self.dayName = dayName
        self.onApply = onApply
        let week = program.week(ofCycle: card.cycle) ?? 1
        _skip = State(initialValue: program.config.periodization && (item.cycleTargets?[safe: week - 1]?.skip ?? false))
    }

    private var week: Int { program.week(ofCycle: card.cycle) ?? 1 }
    private var periodized: Bool { program.config.periodization }

    /// The week's own sets, even when it is skipped, so un-skipping shows what it trains.
    private var shownSets: [WorkoutSet] {
        if card.isDeload { return program.sets(of: item, cycle: card.cycle) ?? [] }
        return periodized ? (item.cycleTargets?[safe: week - 1]?.sets ?? item.sets) : item.sets
    }

    var body: some View {
        var shown = item
        shown.sets = shownSets
        return SetTargetsSheet(
            exercise: shown,
            subtitle: card.title,
            readOnlyNote: card.isDeload ? deloadNote : nil,
            actions: actions,
            onSave: { save($0, scope: SavingScope()) }
        ) {
            if periodized, !card.isDeload {
                Toggle(isOn: $skip) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Skip Exercise").font(AppFont.headline(15))
                        Text("Exercise will be skipped on \(dayName), \(card.title)")
                            .font(AppFont.caption())
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
                .padding(.vertical, 8)
                .tint(Theme.accent)
            }
        }
        .sheet(isPresented: Binding { savingOptions != nil } set: { if !$0 { savingOptions = nil } }) {
            if let sets = savingOptions {
                WeekTargetsSavingOptions(
                    setCount: sets.count, weekTitle: card.title, exerciseName: catalog.name(item.exerciseID),
                    cycleNoun: program.cycleNoun, periodized: periodized
                ) { scope in
                    savingOptions = nil
                    save(sets, scope: scope)
                    dismiss()
                }
            }
        }
    }

    private var actions: [SetTargetsAction] {
        let allWeeks = SetTargetsAction(title: "Save To All \(program.cycleNoun)s") { save($0, scope: .allWeeks) }
        let more = SetTargetsAction(title: "More Options", placement: .belowSave, dismisses: false) { savingOptions = $0 }
        return periodized ? [allWeeks, more] : [more]
    }

    private var deloadNote: String {
        let neighbor = program.config.deload == .firstCycle ? 1 : program.cycles
        return "The deload follows \(program.cycleNoun) \(neighbor) by the deload rule. Edit \(program.cycleNoun) \(neighbor) to change it."
    }

    private func save(_ sets: [WorkoutSet], scope: SavingScope) {
        onApply(WeekTargetsEdit(exerciseID: item.id, week: week, sets: sets, skip: skip), scope)
    }
}

/// "Saving Options · N sets": which weeks and which exercises a save writes.
struct WeekTargetsSavingOptions: View {
    let setCount: Int
    let weekTitle: String
    let exerciseName: String
    let cycleNoun: String
    let periodized: Bool
    let onSave: (SavingScope) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var scope = SavingScope()

    var body: some View {
        NavigationStack {
            List {
                if periodized {
                    Section {
                        ForEach(CycleScope.allCases, id: \.self) { option in
                            radio(title(of: option), selected: scope.cycles == option) { scope.cycles = option }
                        }
                    } header: {
                        Text("Cycle Settings").font(AppFont.title(18)).foregroundStyle(Theme.textPrimary).textCase(nil)
                    }
                }
                Section {
                    ForEach(ExerciseScope.allCases, id: \.self) { option in
                        radio(title(of: option), selected: scope.exercises == option) { scope.exercises = option }
                    }
                } header: {
                    Text("Exercise Settings").font(AppFont.title(18)).foregroundStyle(Theme.textPrimary).textCase(nil)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Theme.surface)
            .programSheetTitle("Saving Options", subtitle: setCount == 1 ? "1 set" : "\(setCount) sets")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                PinnedActionButton("Save") { onSave(scope) }
            }
        }
        .presentationDetents([.large])
        .tint(Theme.textPrimary)
    }

    private func radio(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Text(title).font(AppFont.body(15))
                Spacer()
                Image(systemName: selected ? "largecircle.fill.circle" : "circle").font(AppFont.title())
            }
            .foregroundStyle(Theme.textPrimary)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func title(of option: CycleScope) -> String {
        switch option {
        case .thisWeek: "\(weekTitle) only"
        case .thisAndLater: "\(weekTitle) and beyond"
        case .all: "All \(cycleNoun.lowercased())s"
        }
    }

    private func title(of option: ExerciseScope) -> String {
        switch option {
        case .thisExercise: "\(exerciseName) only"
        case .day: "All exercises for the day"
        case .program: "All exercises in the program"
        }
    }
}
