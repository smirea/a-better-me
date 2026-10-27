import SwiftUI

/// One nutrient's goals (MacroFactor's target icon on a nutrient detail): the active goal and its range, the dated
/// goals newest first, and + for a new one. The Dashboard's nutrient detail pushes this with its nutrient id.
struct NutrientGoalsView: View {
    let nutrient: NutrientID

    @Environment(LocalStore.self) private var store
    @Observe(NutrientGoal.all) private var allGoals
    @Observe(AppSettings.current) private var settings
    @Observe(BodyWeight.latest) private var latestWeight
    @State private var editing: NutrientGoalDraft?

    private var info: Nutrient? { NutrientRegistry.nutrient(nutrient) }
    private var goals: [NutrientGoal] { allGoals.filter { $0.nutrient == nutrient }.sorted { $0.startsOn > $1.startsOn } }
    private var today: CalendarDay { .today }
    private var active: NutrientGoal? { goals.first { $0.startsOn <= today } }

    var body: some View {
        List {
            Section("Active Goal") {
                LabeledContent(NutrientGoalDraft.label(active), value: rangeText(on: today))
            }
            if !goals.isEmpty {
                Section("Goals") {
                    ForEach(goals) { goal in
                        Button {
                            editing = NutrientGoalDraft(goal)
                        } label: {
                            LabeledContent {
                                Text(rangeText(on: goal.startsOn))
                            } label: {
                                Text(NutrientGoalDraft.label(goal))
                                Text("From \(StrategyFormat.day(goal.startsOn, year: true))")
                            }
                        }
                        .foregroundStyle(Theme.textPrimary)
                    }
                    .onDelete { offsets in
                        for goal in offsets.map({ goals[$0] }) { store.deleteNutrientGoal(goal.nutrient, from: goal.startsOn) }
                    }
                }
            }
            Section {
            } footer: {
                Text("All days before the first goal default to Auto: the floor, target, and ceiling are set for you from your sex and weight.")
            }
        }
        .themedList()
        .detailTitle("\(info?.name ?? nutrient.rawValue) Goals")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("New Goal", systemImage: "plus") { editing = NutrientGoalDraft(startsOn: today) }
            }
        }
        .sheet(item: $editing) { draft in
            NutrientGoalEditor(nutrient: nutrient, draft: draft, original: goals.first { $0.startsOn == draft.startsOn })
        }
    }

    private func rangeText(on day: CalendarDay) -> String {
        let range = NutrientGoal.range(nutrient, on: day, goals: allGoals, sex: settings.profile.sex, weightKg: latestWeight?.weightKg)
        return NutrientGoalsListView.text(range, unit: info?.unit)
    }
}

extension NutrientGoalDraft: Identifiable {
    var id: CalendarDay { startsOn }
}

private struct NutrientGoalEditor: View {
    let nutrient: NutrientID
    @State var draft: NutrientGoalDraft
    let original: NutrientGoal?

    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    private var info: Nutrient? { NutrientRegistry.nutrient(nutrient) }
    private var name: String { info?.name ?? nutrient.rawValue }

    var body: some View {
        NavigationStack {
            Form {
                DatePicker(
                    "Goal Start Date",
                    selection: Binding(get: { draft.startsOn.date }, set: { draft.startsOn = CalendarDay($0) }),
                    displayedComponents: .date
                )
                Section("Goal Type") {
                    Picker("Goal Type", selection: $draft.kind) {
                        ForEach(NutrientGoalDraft.Kind.allCases, id: \.self) { kind in
                            VStack(alignment: .leading) {
                                Text(kind.title)
                                Text(kind.subtitle).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                            }
                            .tag(kind)
                        }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }
                if draft.kind == .custom {
                    bound("Target", \.target)
                    bound("Floor", \.floor)
                    bound("Ceiling", \.ceiling)
                }
                if let problem = draft.problem {
                    Section { Text(problem).foregroundStyle(Theme.destructive) }
                }
            }
            .themedList()
            .detailTitle(original == nil ? "New \(name) Goal" : "Edit \(name) Goal")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", systemImage: "checkmark") { save() }
                        .disabled(draft.problem != nil)
                }
            }
        }
    }

    private func bound(_ title: String, _ path: WritableKeyPath<NutrientRange, Double?>) -> some View {
        Section("Custom \(title)") {
            Toggle("Show a \(title.lowercased())", isOn: Binding(
                get: { draft.range[keyPath: path] != nil },
                set: { draft.range[keyPath: path] = $0 ? 0 : nil }
            ))
            .tint(Theme.accent)
            if draft.range[keyPath: path] != nil {
                HStack {
                    TextField("\(name) \(title)", value: Binding(get: { draft.range[keyPath: path] ?? 0 }, set: { draft.range[keyPath: path] = $0 }), format: .number)
                        .keyboardType(.decimalPad)
                    Text(info?.unit.rawValue ?? "").foregroundStyle(Theme.textSecondary)
                }
            }
        }
    }

    private func save() {
        if let original, original.startsOn != draft.startsOn {
            store.deleteNutrientGoal(nutrient, from: original.startsOn)
        }
        store.setNutrientGoal(nutrient, from: draft.startsOn, draft.mode)
        dismiss()
    }
}

/// Every nutrient with its range today, grouped as the registry orders them; each opens its goals. Calories and the
/// macros are left out: their targets come from the program, as in MacroFactor.
struct NutrientGoalsListView: View {
    private static let fromProgram = Set(NutrientID.macros)

    @Observe(NutrientGoal.all) private var goals
    @Observe(AppSettings.current) private var settings
    @Observe(BodyWeight.latest) private var latestWeight

    var body: some View {
        List {
            ForEach(NutrientGroup.allCases, id: \.self) { group in
                Section(group.rawValue.capitalized) {
                    ForEach(NutrientRegistry.all.filter { $0.group == group && !Self.fromProgram.contains($0.id) }) { nutrient in
                        NavigationLink(value: StrategyRoute.nutrient(nutrient.id)) {
                            LabeledContent(nutrient.name, value: Self.text(
                                NutrientGoal.range(nutrient.id, on: .today, goals: goals, sex: settings.profile.sex, weightKg: latestWeight?.weightKg),
                                unit: nutrient.unit
                            ))
                        }
                    }
                }
            }
        }
        .themedList()
        .detailTitle("Nutrient Goals")
    }

    /// "Floor 25 · Target 38 · Ceiling 100 g", or "No targets".
    static func text(_ range: NutrientRange, unit: NutrientUnit?) -> String {
        let parts = [("Floor", range.floor), ("Target", range.target), ("Ceiling", range.ceiling)].compactMap { name, value in
            value.map { "\(name) \($0.formatted(.number.precision(.fractionLength(0...1))))" }
        }
        return parts.isEmpty ? "No targets" : parts.joined(separator: " · ") + " \(unit?.rawValue ?? "")"
    }
}
