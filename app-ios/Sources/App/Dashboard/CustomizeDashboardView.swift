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
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("Customize Dashboard")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    if let draft { store.updateSettings { $0.dashboard = draft } }
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
    static let allCases: [InsightCard] = [.workouts, .weightTrend]

    var title: String { self == .workouts ? "Workouts" : "Weight Trend" }
    var icon: CardIcon { self == .workouts ? .workouts : .trend }
}

extension HabitCard: CaseIterable {
    static let allCases: [HabitCard] = [.weighIn, .workouts]

    var title: String { self == .weighIn ? "Weigh-In" : "Workouts" }
    var icon: CardIcon { self == .weighIn ? .weighInDots : .workoutDots }
}

enum CardIcon {
    case workouts, trend, weighInDots, workoutDots, scale, muscle, exercise, steps

    var symbol: String {
        switch self {
        case .workouts, .muscle, .exercise, .steps: "chart.bar.fill"
        case .trend, .scale: "chart.line.uptrend.xyaxis"
        case .weighInDots, .workoutDots: "ellipsis"
        }
    }

    var color: Color {
        switch self {
        case .workouts, .workoutDots, .steps: DashboardColor.workouts
        case .trend: DashboardColor.trend
        case .weighInDots, .scale: DashboardColor.scale
        case .muscle: DashboardColor.muscle
        case .exercise: DashboardColor.exercise
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

private struct PrimaryFocusPicker: View {
    @Binding var order: [FocusCard]

    private var shown: [FocusCard] {
        order + [FocusCard.workouts, .recentRecords].filter { !order.contains($0) }
    }

    var body: some View {
        HStack(spacing: 14) {
            ForEach(Array(shown.enumerated()), id: \.element) { index, card in
                VStack(spacing: 8) {
                    VStack(alignment: .leading, spacing: 12) {
                        Toggle(card == .workouts ? "Weekly Workouts" : "Recent Records", isOn: Binding(
                            get: { order.contains(card) },
                            set: { on in
                                if on { order.append(card) } else { order.removeAll { $0 == card } }
                            }
                        ))
                        .font(AppFont.headline(12))
                        preview(card)
                            .frame(maxWidth: .infinity, minHeight: 70)
                    }
                    .padding(10)
                    .background(Theme.surface, in: .rect(cornerRadius: Theme.smallCornerRadius))
                    .overlay(RoundedRectangle(cornerRadius: Theme.smallCornerRadius).stroke(Theme.textPrimary.opacity(order.contains(card) ? 0.9 : 0.2)))
                    Button(index == 0 ? "Move Right" : "Move Left", systemImage: index == 0 ? "arrow.right" : "arrow.left") {
                        withAnimation { order = Array(shown.reversed()).filter(order.contains) }
                    }
                    .labelStyle(.iconOnly)
                    .buttonStyle(.borderless)
                    .foregroundStyle(Theme.textPrimary)
                    .disabled(order.count < 2)
                }
            }
        }
        .padding(.vertical, 4)
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
        }
    }
}

private struct AddRemoveSheet: View {
    let section: DashboardSection
    @Binding var layout: DashboardLayout

    @Environment(\.dismiss) private var dismiss
    @Environment(ExerciseCatalog.self) private var catalog
    @Observe(WorkoutSession.finished) private var sessions
    @State private var picking = false

    var body: some View {
        NavigationStack {
            List {
                content.listRowBackground(Theme.surface)
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
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
            let trained = (layout.exercises.map(\.exerciseID) + sessions.flatMap { $0.blocks.flatMap(\.exercises).map(\.exerciseID) })
            ForEach(trained.firstOccurrences(), id: \.self) { id in
                Toggle(isOn: Binding(
                    get: { layout.exercises.contains { $0.exerciseID == id } },
                    set: { on in
                        if on { layout.exercises.append(ExerciseCard(exerciseID: id)) } else { layout.exercises.removeAll { $0.exerciseID == id } }
                    }
                )) { CardRow(title: catalog.exercise(id)?.name ?? "Unknown exercise", icon: .exercise) }
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
        }
    }

    private func toggle<Card: Equatable>(_ title: String, _ icon: CardIcon, _ path: WritableKeyPath<DashboardLayout, [Card]>, _ card: Card) -> some View {
        Toggle(isOn: Binding(
            get: { layout[keyPath: path].contains(card) },
            set: { on in
                if on { layout[keyPath: path].append(card) } else { layout[keyPath: path].removeAll { $0 == card } }
            }
        )) { CardRow(title: title, icon: icon) }
    }
}
