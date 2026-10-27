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
            ThemedSection("Primary Focus") {
                PrimaryFocusPicker(order: binding(\.primaryFocus))
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
            }
            ThemedSection("Section Order") {
                ForEach(layout.sections) { RowLabel(title: $0.title) }
                    .onMove { binding(\.sections).wrappedValue.move(fromOffsets: $0, toOffset: $1) }
            }
            ForEach(layout.sections) { section in
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
                Button("Save", role: .confirm) {
                    if let draft { store.updateSettings { $0.dashboard = draft.saved } }
                    dismiss()
                }
            }
        }
        .sheet(item: $editing) { section in
            AddRemoveSheet(section: section, layout: Binding(get: { draft ?? settings.dashboard }, set: { draft = $0 }))
        }
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
        case .general:
            ForEach(binding(\.general).wrappedValue, id: \.self) { _ in CardRow(title: "Steps", icon: .steps) }
                .onMove { binding(\.general).wrappedValue.move(fromOffsets: $0, toOffset: $1) }
        }
    }

    @Environment(ExerciseCatalog.self) private var catalog

    private func catalogName(_ id: ExerciseID) -> String { catalog.exercise(id)?.name ?? "Unknown exercise" }
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
        case .nutrition: "Nutrition"
        case .bodyMetrics: "Body Metrics"
        case .muscles: "Muscle Groups"
        case .exercises: "Exercises"
        case .general: "General"
        }
    }

    var addTitle: String {
        switch self {
        case .insights: "Insights"
        case .habits: "Habits"
        case .nutrition: "Nutrition"
        case .bodyMetrics: "Body Metrics"
        case .muscles: "Muscle Groups"
        case .exercises: "Exercises"
        case .general: "General"
        }
    }
}

extension InsightCard: CaseIterable {
    static let allCases: [InsightCard] = [.workouts, .weightTrend, .expenditure, .energyBalance, .goalProgress]

    var title: String {
        switch self {
        case .workouts: "Workouts"
        case .weightTrend: "Weight Trend"
        case .expenditure: "Expenditure"
        case .energyBalance: "Energy Balance"
        case .goalProgress: "Goal Progress"
        }
    }

    var icon: CardIcon {
        switch self {
        case .workouts: .workouts
        case .weightTrend: .trend
        case .expenditure: .expenditure
        case .energyBalance: .energyBalance
        case .goalProgress: .goalProgress
        }
    }
}

extension HabitCard: CaseIterable {
    static let allCases: [HabitCard] = [.weighIn, .foodLogging, .workouts]

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

extension FocusCard: CaseIterable {
    static let allCases: [FocusCard] = [.workouts, .recentRecords, .weeklyNutrition, .energyBalance, .dailyNutrition]

    var title: String {
        switch self {
        case .workouts: "Weekly Workouts"
        case .recentRecords: "Recent Records"
        case .weeklyNutrition: "Weekly Nutrition"
        case .energyBalance: "Energy Balance"
        case .dailyNutrition: "Daily Nutrition"
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
        case .workouts, .workoutDots, .steps, .expenditure: Theme.accent
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

/// Every page as a tile with a toggle; the arrows move a shown page one place in the carousel's order.
private struct PrimaryFocusPicker: View {
    @Binding var order: [FocusCard]

    private var shown: [FocusCard] {
        order + FocusCard.allCases.filter { !order.contains($0) }
    }

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 14) {
                ForEach(shown, id: \.self) { card in
                    let index = order.firstIndex(of: card)
                    VStack(spacing: 8) {
                        VStack(alignment: .leading, spacing: 12) {
                            Toggle(card.title, isOn: Binding(
                                get: { order.contains(card) },
                                set: { on in
                                    if on { order.append(card) } else { order.removeAll { $0 == card } }
                                }
                            ))
                            .font(AppFont.headline(12))
                            .tint(Theme.accent)
                            preview(card)
                                .frame(maxWidth: .infinity, minHeight: 70)
                        }
                        .padding(10)
                        .frame(width: 150)
                        .background(Theme.surface, in: .rect(cornerRadius: Theme.smallCornerRadius))
                        .overlay(RoundedRectangle(cornerRadius: Theme.smallCornerRadius).stroke(Theme.textPrimary.opacity(index != nil ? 0.9 : 0.2)))
                        HStack(spacing: 18) {
                            Button("Move \(card.title) Left", systemImage: "arrow.left") { move(card, by: -1) }
                                .disabled(index.map { $0 == 0 } ?? true)
                            Button("Move \(card.title) Right", systemImage: "arrow.right") { move(card, by: 1) }
                                .disabled(index.map { $0 == order.count - 1 } ?? true)
                        }
                        .labelStyle(.iconOnly)
                        .buttonStyle(.borderless)
                        .foregroundStyle(Theme.textPrimary)
                    }
                }
            }
            .padding(.vertical, 4)
        }
        .scrollIndicators(.hidden)
    }

    private func move(_ card: FocusCard, by offset: Int) {
        guard let index = order.firstIndex(of: card) else { return }
        withAnimation { order.swapAt(index, index + offset) }
    }

    @ViewBuilder
    private func preview(_ card: FocusCard) -> some View {
        switch card {
        case .workouts:
            HStack(spacing: 6) {
                ProgressRing(fraction: 1, color: Theme.muscle, lineWidth: 2.5).frame(width: 26, height: 26)
                ProgressRing(fraction: 1, color: Theme.accent, lineWidth: 2.5).frame(width: 36, height: 36)
                ProgressRing(fraction: 1, color: Theme.exercise, lineWidth: 2.5).frame(width: 26, height: 26)
            }
        case .recentRecords:
            VStack(alignment: .leading, spacing: 5) {
                ForEach([0.9, 0.7, 0.8, 0.6, 0.75], id: \.self) { width in
                    Capsule().fill(Theme.records).frame(width: 90 * width, height: 4)
                }
            }
        case .weeklyNutrition:
            Grid(horizontalSpacing: 7, verticalSpacing: 5) {
                ForEach(NutritionMetrics.macros, id: \.self) { id in
                    GridRow {
                        ForEach(0..<7, id: \.self) { _ in
                            Capsule().fill(Theme.macro(id)).frame(width: 4, height: 10)
                        }
                    }
                }
            }
        case .energyBalance:
            HStack(alignment: .bottom, spacing: 3) {
                ForEach(Array([0.6, 0.8, 0.5, 0.9, 0.7, 0.75, 0.55, 0.85, 0.65, 0.8].enumerated()), id: \.offset) { _, height in
                    Capsule().fill(Theme.calories).frame(width: 5, height: 40 * height)
                }
            }
        case .dailyNutrition:
            VStack(spacing: 8) {
                ProgressRing(fraction: 1, color: Theme.calories, lineWidth: 2.5, arc: 0.75)
                    .frame(width: 34, height: 34)
                HStack(spacing: 10) {
                    ForEach([NutrientID.protein, .fat, .carbs], id: \.self) { id in
                        Capsule().fill(Theme.macro(id)).frame(width: 22, height: 3)
                    }
                }
            }
        }
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
            .navigationTitle(section.title)
            .navigationSubtitle("Add or remove tiles")
            .navigationBarTitleDisplayMode(.inline)
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
        case .nutrition:
            ThemedSection("Calories & Macros") {
                toggle("Macros", .macros, \.nutrition, .macros, matching: { $0.nutrient == nil })
                nutrientToggles(NutritionMetrics.macros)
            }
            ForEach(NutrientGroup.allCases, id: \.self) { group in
                let ids = NutrientRegistry.all.filter { $0.group == group && !NutritionMetrics.macros.contains($0.id) }.map(\.id)
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
        case .general:
            ThemedSection {
                toggle("Steps", .steps, \.general, .steps)
            }
        case .muscles:
            ThemedSection("Upper") { muscleToggles(Muscle.upperBody) }
            ThemedSection("Lower") { muscleToggles(Muscle.lowerBody) }
        case .exercises:
            let trained = layout.exercises.map(\.exerciseID) + values.trainedExercises
            ThemedSection {
                ForEach(trained.firstOccurrences(), id: \.self) { id in
                    toggle(
                        catalog.exercise(id)?.name ?? "Unknown exercise", .exercise, \.exercises, ExerciseCard(exerciseID: id),
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
