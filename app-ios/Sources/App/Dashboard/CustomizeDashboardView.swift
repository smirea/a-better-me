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
            Section {
                PrimaryFocusPicker(order: binding(\.primaryFocus))
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
            } header: {
                Text("Primary Focus").font(AppFont.title()).foregroundStyle(Theme.textPrimary)
            }
            ForEach(Array(layout.sections.enumerated()), id: \.element) { index, section in
                Section {
                    rows(section)
                    Button("Add or Remove \(section.addTitle)") { editing = section }
                        .font(AppFont.medium(16))
                        .frame(maxWidth: .infinity)
                        .foregroundStyle(Theme.textPrimary)
                        .moveDisabled(true)
                } header: {
                    HStack {
                        Text(section.title).font(AppFont.title()).foregroundStyle(Theme.textPrimary)
                        Spacer()
                        Button("Move \(section.title) Up", systemImage: "arrow.up") { moveSection(index, by: -1) }
                            .disabled(index == 0)
                        Button("Move \(section.title) Down", systemImage: "arrow.down") { moveSection(index, by: 1) }
                            .disabled(index == layout.sections.count - 1)
                    }
                    .labelStyle(.iconOnly)
                    .buttonStyle(.borderless)
                    .foregroundStyle(Theme.textPrimary)
                }
                .listRowBackground(Theme.surface)
            }
            Section {
                Button("Reset to App Defaults", role: .destructive) { draft = DashboardLayout() }
                    .frame(maxWidth: .infinity)
                    .foregroundStyle(Theme.destructive)
            }
            .listRowBackground(Theme.surface)
        }
        .environment(\.editMode, .constant(.active))
        .themedList()
        .navigationTitle("Customize Dashboard")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
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

    private func moveSection(_ index: Int, by offset: Int) {
        withAnimation { binding(\.sections).wrappedValue.swapAt(index, index + offset) }
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
        case .bodyMetrics:
            ForEach(binding(\.bodyMetrics).wrappedValue, id: \.self) { _ in CardRow(title: "Scale Weight", icon: .scale) }
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
    case expenditure, energyBalance, goalProgress, foodLoggingDots

    var symbol: String {
        switch self {
        case .workouts, .muscle, .exercise, .steps, .energyBalance: "chart.bar.fill"
        case .trend, .scale, .expenditure: "chart.line.uptrend.xyaxis"
        case .weighInDots, .workoutDots, .foodLoggingDots: "ellipsis"
        case .goalProgress: "minus"
        }
    }

    var color: Color {
        switch self {
        case .workouts, .workoutDots, .steps: DashboardColor.workouts
        case .trend: DashboardColor.trend
        case .weighInDots, .scale: DashboardColor.scale
        case .muscle: DashboardColor.muscle
        case .exercise: DashboardColor.exercise
        case .expenditure: DashboardColor.expenditure
        case .energyBalance, .foodLoggingDots: DashboardColor.energy
        case .goalProgress: DashboardColor.goal
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
                .background(Theme.surfaceRaised, in: .rect(cornerRadius: 4))
                .accessibilityHidden(true)
            Text(title).font(AppFont.medium(15)).lineLimit(1)
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
        .font(AppFont.body(14))
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
                Circle().stroke(Theme.muscle, lineWidth: 2.5).frame(width: 26)
                Circle().stroke(Theme.accent, lineWidth: 2.5).frame(width: 36)
                Circle().stroke(DashboardColor.exercise, lineWidth: 2.5).frame(width: 26)
            }
        case .recentRecords:
            VStack(alignment: .leading, spacing: 5) {
                ForEach([0.9, 0.7, 0.8, 0.6, 0.75], id: \.self) { width in
                    Capsule().fill(DashboardColor.records).frame(width: 90 * width, height: 4)
                }
            }
        case .weeklyNutrition:
            Grid(horizontalSpacing: 7, verticalSpacing: 5) {
                ForEach(NutritionMetrics.macros, id: \.self) { id in
                    GridRow {
                        ForEach(0..<7, id: \.self) { _ in
                            Capsule().fill(DashboardColor.nutrient(id)).frame(width: 4, height: 10)
                        }
                    }
                }
            }
        case .energyBalance:
            HStack(alignment: .bottom, spacing: 3) {
                ForEach(Array([0.6, 0.8, 0.5, 0.9, 0.7, 0.75, 0.55, 0.85, 0.65, 0.8].enumerated()), id: \.offset) { _, height in
                    Capsule().fill(DashboardColor.energy).frame(width: 5, height: 40 * height)
                }
            }
        case .dailyNutrition:
            VStack(spacing: 8) {
                Circle().trim(from: 0, to: 0.75)
                    .stroke(DashboardColor.energy, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                    .rotationEffect(.degrees(135))
                    .frame(width: 34, height: 34)
                HStack(spacing: 10) {
                    ForEach([NutrientID.protein, .fat, .carbs], id: \.self) { id in
                        Capsule().fill(DashboardColor.nutrient(id)).frame(width: 22, height: 3)
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
                content.listRowBackground(Theme.surface)
            }
            .themedList()
            .navigationTitle(section.title)
            .navigationSubtitle("Add or remove tiles")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", systemImage: "checkmark") { dismiss() }
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
            ForEach(InsightCard.allCases, id: \.self) { toggle($0.title, $0.icon, \.insights, $0) }
        case .habits:
            ForEach(HabitCard.allCases, id: \.self) { toggle($0.title, $0.icon, \.habits, $0) }
        case .bodyMetrics:
            toggle("Scale Weight", .scale, \.bodyMetrics, .scaleWeight)
        case .general:
            toggle("Steps", .steps, \.general, .steps)
        case .muscles:
            Section("Upper") { muscleToggles(Muscle.upperBody) }
            Section("Lower") { muscleToggles(Muscle.lowerBody) }
        case .exercises:
            let trained = layout.exercises.map(\.exerciseID) + values.trainedExercises
            ForEach(trained.firstOccurrences(), id: \.self) { id in
                Toggle(isOn: Binding(
                    get: { layout.exercises.contains { $0.exerciseID == id } },
                    set: { on in
                        if on { layout.exercises.append(ExerciseCard(exerciseID: id)) } else { layout.exercises.removeAll { $0.exerciseID == id } }
                    }
                )) { CardRow(title: catalog.exercise(id)?.name ?? "Unknown exercise", icon: .exercise) }
                .tint(Theme.accent)
            }
        }
    }

    private func muscleToggles(_ muscles: [Muscle]) -> some View {
        ForEach(muscles) { muscle in
            Toggle(isOn: Binding(
                get: { layout.muscles.contains { $0.muscle == muscle } },
                set: { on in
                    if on { layout.muscles.append(MuscleCard(muscle: muscle)) } else { layout.muscles.removeAll { $0.muscle == muscle } }
                }
            )) { CardRow(title: muscle.displayName, icon: .muscle) }
            .tint(Theme.accent)
        }
    }

    private func toggle<Card: Equatable>(_ title: String, _ icon: CardIcon, _ path: WritableKeyPath<DashboardLayout, [Card]>, _ card: Card) -> some View {
        Toggle(isOn: Binding(
            get: { layout[keyPath: path].contains(card) },
            set: { on in
                if on { layout[keyPath: path].append(card) } else { layout[keyPath: path].removeAll { $0 == card } }
            }
        )) { CardRow(title: title, icon: icon) }
        .tint(Theme.accent)
    }
}
