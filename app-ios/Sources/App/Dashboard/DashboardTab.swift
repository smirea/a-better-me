import HealthKitUI
import SwiftUI

struct DashboardTab: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(LocalStore.self) private var store
    @State private var health = HealthData()

    var body: some View {
        NavigationStack {
            DashboardDataReader { data in DashboardHome(data: data) }
                .navigationDestination(for: DashboardRoute.self) { route in
                    switch route {
                    case .customize: CustomizeDashboardView()
                    case .allMuscles: AllMusclesView()
                    case .allExercises: AllExercisesView()
                    case let .muscle(_, metric): MetricDetailView(route: route, initialTab: metric.title)
                    case let .exercise(_, metric): MetricDetailView(route: route, initialTab: metric.title)
                    default: MetricDetailView(route: route)
                    }
                }
        }
        .environment(health)
        .healthDataAccessRequest(store: health.store, shareTypes: HealthData.shareTypes, readTypes: HealthData.readTypes, trigger: health.requestTrigger) { _ in
            Task { await health.load() }
        }
        .task {
            #if DEBUG
            DashboardSeed.seedIfRequested(store)
            #endif
            await health.refresh()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await health.refresh() } }
        }
    }
}

struct DashboardDataReader<Content: View>: View {
    @ViewBuilder let content: (DashboardData) -> Content

    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(HealthData.self) private var health
    @Observe(WorkoutSession.finished) private var sessions
    @Observe(BodyWeight.all) private var logged
    @Observe(AppSettings.current) private var settings

    var body: some View {
        content(DashboardData(
            sessions: sessions,
            weighIns: WeighIns.merge(logged: logged, health: health.weights),
            steps: health.steps,
            unit: settings.weightUnit,
            catalog: catalog.exercise
        ))
    }
}

private struct DashboardHome: View {
    let data: DashboardData

    @Observe(AppSettings.current) private var settings
    @Observe(WorkoutTemplate.all) private var templates
    @Observe(Program.active) private var program
    @State private var scope = DashboardMetrics.CycleScope.activeProgram
    @State private var recordKind = ExerciseRecord.Kind.volume

    private var layout: DashboardLayout { settings.dashboard }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 30) {
                if !layout.primaryFocus.isEmpty {
                    primaryFocus
                }
                ForEach(layout.sections, id: \.self) { section in
                    self.section(section)
                }
            }
            .padding(.bottom, 30)
        }
        .background(Theme.background)
        .screenTitle("Dashboard")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink(value: DashboardRoute.customize) {
                    Image(systemName: "slider.horizontal.3")
                }
                .accessibilityLabel("Customize Dashboard")
            }
        }
    }

    private var primaryFocus: some View {
        TabView {
            ForEach(layout.primaryFocus, id: \.self) { card in
                Group {
                    switch card {
                    case .workouts:
                        CycleRingsCard(
                            progress: DashboardMetrics.cycleProgress(
                                program == nil ? .allWorkouts : scope, program: program, templates: templates, sessions: data.sessions,
                                now: data.now, calendar: data.calendar, catalog: data.catalog
                            ),
                            hasProgram: program != nil,
                            scope: $scope
                        )
                    case .recentRecords:
                        RecentRecordsCard(
                            records: DashboardMetrics.recentRecords(data.sessions, kind: recordKind, catalog: data.catalog),
                            label: recordLabel,
                            name: { data.catalog($0)?.name ?? "Unknown exercise" },
                            kind: $recordKind
                        )
                    }
                }
                .padding(.horizontal, 20)
                .frame(maxHeight: .infinity, alignment: .top)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: layout.primaryFocus.count > 1 ? .always : .never))
        .frame(height: 360)
    }

    private func recordLabel(_ value: Double) -> String {
        switch recordKind {
        case .reps: "\(Int(value)) reps"
        case .volume, .oneRepMax: "\(data.unit.fromKg(value).dashboardText) \(data.unit.rawValue)"
        }
    }

    @ViewBuilder
    private func section(_ section: DashboardSection) -> some View {
        switch section {
        case .insights where !layout.insights.isEmpty:
            DashboardSectionView(title: "Insights & Analytics") {
                ForEach(layout.insights, id: \.self) { insight($0) }
            }
        case .habits where !layout.habits.isEmpty:
            DashboardSectionView(title: "Habits") {
                ForEach(layout.habits, id: \.self) { habit($0) }
            }
        case .bodyMetrics where !layout.bodyMetrics.isEmpty:
            DashboardSectionView(title: "Body Metrics") {
                ForEach(layout.bodyMetrics, id: \.self) { _ in scaleWeight }
            }
        case .muscles where !layout.muscles.isEmpty:
            DashboardSectionView(title: "Muscle Groups", seeAll: .allMuscles) {
                ForEach(layout.muscles, id: \.self) { MuscleCardView(card: $0, data: data) }
            }
        case .exercises where !layout.exercises.isEmpty:
            DashboardSectionView(title: "Exercises", seeAll: .allExercises) {
                ForEach(layout.exercises, id: \.self) { ExerciseCardView(card: $0, data: data) }
            }
        case .general where layout.general.contains(.steps):
            DashboardSectionView(title: "General") {
                let days = data.lastDays(data.steps)
                NavigationLink(value: DashboardRoute.steps) {
                    DashboardCard(title: "Steps", period: "Last 7 Days", value: data.steps.isEmpty ? nil : Int(days.last!).formatted(), unit: "steps") {
                        MiniBars(values: days, color: DashboardColor.workouts)
                    }
                }
            }
        default:
            EmptyView()
        }
    }

    @ViewBuilder
    private func insight(_ card: InsightCard) -> some View {
        switch card {
        case .workouts:
            let sets = DashboardMetrics.workouts(data.sessions, metric: .sets, catalog: data.catalog).suffix(7).map(\.value)
            NavigationLink(value: DashboardRoute.workouts) {
                DashboardCard(title: "Workouts", period: "Last 7 Workouts", value: sets.last?.dashboardText, unit: "sets") {
                    MiniBars(values: sets, color: DashboardColor.workouts)
                }
            }
        case .weightTrend:
            let trend = data.weight(data.trend).suffix(7).map(\.value)
            NavigationLink(value: DashboardRoute.weightTrend) {
                DashboardCard(title: "Weight Trend", period: "Last 7 Days", value: trend.last?.dashboardText, unit: data.unit.rawValue) {
                    MiniLine(values: trend, color: DashboardColor.trend)
                }
            }
        }
    }

    @ViewBuilder
    private func habit(_ card: HabitCard) -> some View {
        switch card {
        case .weighIn:
            let dates = data.weighIns.map(\.date)
            NavigationLink(value: DashboardRoute.scaleWeight) {
                DashboardCard(title: "Weigh-In", period: "Last 30 Days", value: "\(DashboardMetrics.daysThisWeek(dates, now: data.now, calendar: data.calendar))/7", unit: "this week") {
                    DotGrid(days: DashboardMetrics.habitDays(dates, now: data.now, calendar: data.calendar), color: DashboardColor.scale)
                }
            }
        case .workouts:
            let dates = data.sessions.map(\.startedAt)
            NavigationLink(value: DashboardRoute.workouts) {
                DashboardCard(title: "Workouts", period: "Last 30 Days", value: "\(dates.count { data.calendar.isDate($0, equalTo: data.now, toGranularity: .weekOfYear) })", unit: "this week") {
                    DotGrid(days: DashboardMetrics.habitDays(dates, now: data.now, calendar: data.calendar), color: DashboardColor.workouts)
                }
            }
        }
    }

    private var scaleWeight: some View {
        let entries = data.weighIns.suffix(7).map { data.unit.fromKg($0.kg) }
        return NavigationLink(value: DashboardRoute.scaleWeight) {
            DashboardCard(title: "Scale Weight", period: "Last 7 Entries", value: entries.last?.dashboardText, unit: data.unit.rawValue) {
                MiniLine(values: entries, color: DashboardColor.scale)
            }
        }
    }
}

struct DashboardSectionView<Cards: View>: View {
    let title: String
    var seeAll: DashboardRoute?
    @ViewBuilder let cards: Cards

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title).font(AppFont.title())
                Spacer()
                if let seeAll {
                    NavigationLink(value: seeAll) {
                        Text("See All").font(AppFont.medium(15)).underline()
                    }
                    .foregroundStyle(Theme.textPrimary)
                    .accessibilityLabel("See All \(title)")
                }
            }
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                cards
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20)
    }
}

struct MuscleCardView: View {
    let card: MuscleCard
    let data: DashboardData

    var body: some View {
        let days = data.lastDays(data.muscle(card.muscle, card.metric))
        let total = days.reduce(0, +)
        NavigationLink(value: DashboardRoute.muscle(card.muscle, card.metric)) {
            DashboardCard(title: card.muscle.displayName, period: "Last 7 Days", value: total > 0 ? total.dashboardText : nil, unit: data.muscleUnit(card.metric)) {
                MiniBars(values: days, color: DashboardColor.muscle)
            }
        }
    }
}

struct ExerciseCardView: View {
    let card: ExerciseCard
    let data: DashboardData

    var body: some View {
        let values = data.exercise(card.exerciseID, card.metric).suffix(7).map(\.value)
        NavigationLink(value: DashboardRoute.exercise(card.exerciseID, card.metric)) {
            DashboardCard(title: data.catalog(card.exerciseID)?.name ?? "Unknown exercise", period: "Last 7 Workouts", value: values.last?.dashboardText, unit: data.exerciseUnit(card.metric)) {
                MiniLine(values: values, color: DashboardColor.exercise)
            }
        }
    }
}

struct AllMusclesView: View {
    var body: some View {
        DashboardDataReader { data in
            ScrollView {
                VStack(alignment: .leading, spacing: 30) {
                    ForEach([("Upper", Muscle.upperBody), ("Lower", Muscle.lowerBody)], id: \.0) { title, muscles in
                        DashboardSectionView(title: title) {
                            ForEach(muscles) { MuscleCardView(card: MuscleCard(muscle: $0), data: data) }
                        }
                    }
                }
                .padding(.vertical, 16)
            }
            .background(Theme.background)
            .navigationTitle("Muscle Groups")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

struct AllExercisesView: View {
    var body: some View {
        DashboardDataReader { data in
            let ids = data.sessions.sorted { $0.startedAt > $1.startedAt }.flatMap { $0.blocks.flatMap(\.exercises).map(\.exerciseID) }.firstOccurrences()
            ScrollView {
                DashboardSectionView(title: "Trained") {
                    ForEach(ids, id: \.self) { ExerciseCardView(card: ExerciseCard(exerciseID: $0), data: data) }
                }
                .padding(.vertical, 16)
            }
            .background(Theme.background)
            .navigationTitle("Exercises")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

extension Array where Element: Hashable {
    func firstOccurrences() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}
