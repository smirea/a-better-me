import Feedback
import SwiftUI

struct CustomizeDashboardView: View {
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Observe(AppSettings.current) private var settings
    @State private var draft: DashboardLayout?
    @State private var editing: DashboardSection?

    var body: some View {
        let layout = draft ?? settings.dashboard
        List {
            ThemedSection("Section Order") {
                ForEach(layout.sections) { RowLabel(title: $0.title) }
                    .onMove { binding(\.sections).wrappedValue.move(fromOffsets: $0, toOffset: $1) }
            }
            ForEach(layout.sections.filter { $0 != .pings }) { section in
                ThemedSection(section.title) {
                    rows(section)
                    Button("Add or Remove \(section.addTitle)") { editing = section }
                        .font(AppFont.medium(16))
                        .frame(maxWidth: .infinity)
                        .foregroundStyle(Theme.textPrimary)
                        .moveDisabled(true)
                }
            }
            ThemedSection {
                ResetRowButton("Reset to App Defaults") { draft = DashboardLayout() }
            }
        }
        .environment(\.editMode, .constant(.active))
        .themedList()
        .detailTitle("Customize Dashboard")
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(role: .confirm) {
                    if let draft { store.updateSettings { $0.dashboard = draft.saved } }
                    dismiss()
                }
                .accessibilityLabel("Save")
            }
        }
        .sheet(item: $editing) { section in
            AddRemoveSheet(section: section, layout: Binding(get: { draft ?? settings.dashboard }, set: { draft = $0 }))
        }
        .feedback(self)
    }

    private func binding<Value>(_ path: WritableKeyPath<DashboardLayout, Value>) -> Binding<Value> {
        Binding(
            get: { (draft ?? settings.dashboard)[keyPath: path] },
            set: { value in
                var layout = draft ?? settings.dashboard
                layout[keyPath: path] = value
                draft = layout
            }
        )
    }

    @ViewBuilder
    private func rows(_ section: DashboardSection) -> some View {
        switch section {
        case .insights:
            ForEach(binding(\.insights).wrappedValue, id: \.self) { CardRow(title: $0.title, icon: $0.icon) }
                .onMove { binding(\.insights).wrappedValue.move(fromOffsets: $0, toOffset: $1) }
        case .habits:
            ForEach(binding(\.habits).wrappedValue, id: \.self) { CardRow(title: $0.title, icon: $0.icon) }
                .onMove { binding(\.habits).wrappedValue.move(fromOffsets: $0, toOffset: $1) }
        case .pings: EmptyView()
        case .nutrition:
            ForEach(binding(\.nutrition)) { $card in
                if let id = card.nutrient {
                    CardRow(title: NutrientRegistry.nutrient(id)?.name ?? id.rawValue, icon: .nutrient) {
                        Menu {
                            Picker("Nutrient Display", selection: $card.display) {
                                Text("Percent").tag(NutritionCard.Display.percent)
                                Text("Consumed").tag(NutritionCard.Display.consumed)
                                Text("Remaining").tag(NutritionCard.Display.remaining)
                            }
                        } label: { MetricMenuLabel(title: card.display.title) }
                            .accessibilityLabel("\(NutrientRegistry.nutrient(id)?.name ?? id.rawValue) display")
                    }
                } else {
                    CardRow(title: "Macros", icon: .macros)
                }
            }
            .onMove { binding(\.nutrition).wrappedValue.move(fromOffsets: $0, toOffset: $1) }
        case .bodyMetrics:
            ForEach(binding(\.bodyMetrics).wrappedValue, id: \.self) { CardRow(title: $0.title, icon: .scale) }
                .onMove { binding(\.bodyMetrics).wrappedValue.move(fromOffsets: $0, toOffset: $1) }
        case .muscles:
            ForEach(binding(\.muscles)) { $card in
                CardRow(title: card.muscle.displayName, icon: .muscle) {
                    Menu {
                        Picker("Muscle Group Display", selection: $card.metric) {
                            Text("Sets").tag(MuscleMetric.sets)
                            Text("Volume").tag(MuscleMetric.volume)
                        }
                    } label: { MetricMenuLabel(title: card.metric.title) }
                        .accessibilityLabel("\(card.muscle.displayName) metric")
                }
            }
            .onMove { binding(\.muscles).wrappedValue.move(fromOffsets: $0, toOffset: $1) }
        case .exercises:
            ForEach(binding(\.exercises)) { $card in
                CardRow(title: catalogName(card.exerciseID), icon: .exercise) {
                    Menu {
                        Picker("Exercise Display", selection: $card.metric) {
                            ForEach(ExerciseChartMetric.allCases, id: \.self) { Text($0.title).tag($0) }
                        }
                    } label: { MetricMenuLabel(title: card.metric.title) }
                        .accessibilityLabel("\(catalogName(card.exerciseID)) metric")
                }
            }
            .onMove { binding(\.exercises).wrappedValue.move(fromOffsets: $0, toOffset: $1) }
        }
    }

    @Environment(ExerciseCatalog.self) private var catalog

    private func catalogName(_ id: ExerciseID) -> String { catalog.exercise(id)?.name ?? Exercise.unknownName }
}

extension MuscleCard: Identifiable {
    var id: Muscle { muscle }
}

extension ExerciseCard: Identifiable {
    var id: ExerciseID { exerciseID }
}

extension DashboardSection: Identifiable {
    var id: Self { self }

    var title: String {
        switch self {
        case .insights: "Insights & Analytics"
        case .habits: "Habits"
        case .pings: "Pings"
        case .nutrition: "Nutrition"
        case .bodyMetrics: "Body Metrics"
        case .muscles: "Muscle Groups"
        case .exercises: "Exercises"
        }
    }

    var addTitle: String {
        switch self {
        case .insights: "Insights"
        case .habits: "Habits"
        case .pings: "Pings"
        case .nutrition: "Nutrition"
        case .bodyMetrics: "Body Metrics"
        case .muscles: "Muscle Groups"
        case .exercises: "Exercises"
        }
    }
}

extension InsightCard {
    var title: String {
        switch self {
        case .workouts: "Workouts"
        case .weightTrend: "Weight Trend"
        case .expenditure: "Expenditure"
        case .energyBalance: "Energy Balance"
        case .goalProgress: "Goal Progress"
        case .steps: "Steps"
        }
    }

    var icon: CardIcon {
        switch self {
        case .workouts: .workouts
        case .weightTrend: .trend
        case .expenditure: .expenditure
        case .energyBalance: .energyBalance
        case .goalProgress: .goalProgress
        case .steps: .steps
        }
    }
}

extension HabitCard {
    var title: String {
        switch self {
        case .weighIn: "Weigh-In"
        case .workouts: "Workouts"
        case .foodLogging: "Food Logging"
        }
    }

    var icon: CardIcon {
        switch self {
        case .weighIn: .weighInDots
        case .workouts: .workoutDots
        case .foodLogging: .foodLoggingDots
        }
    }
}

enum CardIcon {
    case workouts, trend, weighInDots, workoutDots, scale, muscle, exercise, steps
    case expenditure, energyBalance, goalProgress, foodLoggingDots, nutrient, macros

    var symbol: String {
        switch self {
        case .workouts, .muscle, .exercise, .steps, .energyBalance, .macros: "chart.bar.fill"
        case .nutrient: "minus"
        case .trend, .scale, .expenditure: "chart.line.uptrend.xyaxis"
        case .weighInDots, .workoutDots, .foodLoggingDots: "ellipsis"
        case .goalProgress: "minus"
        }
    }

    var color: Color {
        switch self {
        case .workouts, .workoutDots: Theme.accent
        case .steps, .expenditure: Theme.coral
        case .trend: Theme.weightTrend
        case .weighInDots, .scale: Theme.green
        case .muscle: Theme.muscle
        case .exercise: Theme.exercise
        case .energyBalance, .foodLoggingDots, .nutrient: Theme.calories
        case .macros: Theme.protein
        case .goalProgress: Theme.goal
        }
    }
}

private struct CardRow<Trailing: View>: View {
    let title: String
    let icon: CardIcon
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon.symbol)
                .font(.footnote.weight(.bold))
                .foregroundStyle(icon.color)
                .frame(width: 30, height: 24)
                .background(Theme.surfaceRaised, in: .rect(cornerRadius: Theme.tinyCornerRadius))
                .accessibilityHidden(true)
            RowLabel(title: title).lineLimit(1)
            Spacer(minLength: 8)
            trailing
        }
    }
}

extension CardRow where Trailing == EmptyView {
    init(title: String, icon: CardIcon) {
        self.init(title: title, icon: icon) { EmptyView() }
    }
}

private struct MetricMenuLabel: View {
    let title: String

    var body: some View {
        HStack(spacing: 4) {
            Text(title)
            Image(systemName: "chevron.down").font(.caption2.weight(.bold))
        }
        .font(AppFont.chip)
        .foregroundStyle(Theme.textSecondary)
    }
}

private struct AddRemoveSheet: View {
    let section: DashboardSection
    @Binding var layout: DashboardLayout

    @Environment(\.dismiss) private var dismiss
    @Environment(ExerciseCatalog.self) private var catalog
    private var values = DashboardValues()
    @State private var picking = false

    var body: some View {
        NavigationStack {
            List {
                content
            }
            .themedList()
            .detailTitle(section.title, subtitle: "Add or remove tiles")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .confirm) { dismiss() }
                }
                if section == .exercises {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Find Exercise", systemImage: "magnifyingglass") { picking = true }
                    }
                }
            }
            .sheet(isPresented: $picking) {
                ExercisePicker(mode: .add) { pick in
                    for id in pick.exerciseIDs where !layout.exercises.contains(where: { $0.exerciseID == id }) {
                        layout.exercises.append(ExerciseCard(exerciseID: id))
                    }
                }
            }
        }
        .feedback("AddRemoveSheet", data: section)
    }

    @ViewBuilder
    private var content: some View {
        switch section {
        case .insights:
            ThemedSection {
                ForEach(InsightCard.allCases, id: \.self) { toggle($0.title, $0.icon, \.insights, $0) }
            }
        case .habits:
            ThemedSection {
                ForEach(HabitCard.allCases, id: \.self) { toggle($0.title, $0.icon, \.habits, $0) }
            }
        case .pings: EmptyView()
        case .nutrition:
            ThemedSection("Calories & Macros") {
                toggle("Macros", .macros, \.nutrition, .macros, matching: { $0.nutrient == nil })
                nutrientToggles(NutrientID.macros)
            }
            ForEach(NutrientGroup.allCases, id: \.self) { group in
                let ids = NutrientRegistry.all.filter { $0.group == group && !NutrientID.macros.contains($0.id) }.map(\.id)
                if !ids.isEmpty {
                    ThemedSection(group.title) { nutrientToggles(ids) }
                }
            }
        case .bodyMetrics:
            let available = BodyMetricCard.available(visible: values.nutritionSettings.visibleBodyMetrics)
            ThemedSection {
                ForEach(BodyMetricCard.allCases, id: \.self) { card in
                    if available.contains(card) {
                        toggle(card.title, .scale, \.bodyMetrics, card)
                    } else {
                        LabeledContent { Text("Turned Off").foregroundStyle(Theme.textSecondary) } label: { CardRow(title: card.title, icon: .scale) }
                    }
                }
            }
        case .muscles:
            ThemedSection("Upper") { muscleToggles(Muscle.upperBody) }
            ThemedSection("Lower") { muscleToggles(Muscle.lowerBody) }
        case .exercises:
            let trained = layout.exercises.map(\.exerciseID) + values.trainedExercises
            ThemedSection {
                ForEach(trained.firstOccurrences(), id: \.self) { id in
                    toggle(
                        catalog.exercise(id)?.name ?? Exercise.unknownName, .exercise, \.exercises, ExerciseCard(exerciseID: id),
                        matching: { $0.exerciseID == id }
                    )
                }
            }
        }
    }

    private func muscleToggles(_ muscles: [Muscle]) -> some View {
        ForEach(muscles) { muscle in
            toggle(muscle.displayName, .muscle, \.muscles, MuscleCard(muscle: muscle), matching: { $0.muscle == muscle })
        }
    }

    private func nutrientToggles(_ ids: [NutrientID]) -> some View {
        ForEach(ids, id: \.self) { id in
            toggle(NutrientRegistry.nutrient(id)?.name ?? id.rawValue, .nutrient, \.nutrition, NutritionCard(nutrient: id), matching: { $0.nutrient == id })
        }
    }

    /// `matching` finds the card whatever its display setting, so turning a nutrient off removes it however it shows.
    private func toggle<Card: Equatable>(
        _ title: String, _ icon: CardIcon, _ path: WritableKeyPath<DashboardLayout, [Card]>, _ card: Card, matching: ((Card) -> Bool)? = nil
    ) -> some View {
        let matches = matching ?? { $0 == card }
        return Toggle(isOn: Binding(
            get: { layout[keyPath: path].contains(where: matches) },
            set: { on in
                if on { layout[keyPath: path].append(card) } else { layout[keyPath: path].removeAll(where: matches) }
            }
        )) { CardRow(title: title, icon: icon) }
        .tint(Theme.accent)
    }
}

extension NutritionCard: Identifiable {
    var id: String { nutrient?.rawValue ?? "macros" }
}

extension NutritionCard.Display {
    var title: String {
        switch self {
        case .percent: "Percent"
        case .consumed: "Consumed"
        case .remaining: "Remaining"
        }
    }
}
