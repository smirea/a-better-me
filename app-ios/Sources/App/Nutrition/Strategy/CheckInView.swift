import SwiftUI

/// The weekly check-in: the Weigh-In and Review Your Week modules the settings allow (MacroFactor's Weigh-In, Partial
/// Logging, and Fasting), then Program Update, which writes the `check_in` plan.
struct CheckInView: View {
    typealias Module = CheckInRules.Module

    @Environment(\.dismiss) private var dismiss
    @Observe(AppSettings.current) private var settings
    @State private var path: [Module] = []

    private var modules: [Module] { CheckInRules.modules(settings.nutrition) }

    var body: some View {
        NavigationStack(path: $path) {
            page(modules[0])
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Close", systemImage: "xmark") { dismiss() }
                    }
                }
                .navigationDestination(for: Module.self) { page($0) }
        }
        .tint(Theme.textPrimary)
    }

    private func page(_ module: Module) -> some View {
        StrategyDataReader { data in
            CheckInPage(module: module, data: data, progress: Double((modules.firstIndex(of: module) ?? 0) + 1) / Double(modules.count)) {
                if let index = modules.firstIndex(of: module), index + 1 < modules.count {
                    path.append(modules[index + 1])
                } else {
                    dismiss()
                }
            }
        }
    }
}

private struct CheckInPage: View {
    let module: CheckInView.Module
    let data: StrategyData
    let progress: Double
    let next: () -> Void

    @Environment(LocalStore.self) private var store
    @State private var loggingWeight = false

    private var update: NutritionPlan? {
        guard let current = data.current, let basis = data.basis else { return nil }
        return CheckInRules.checkedIn(current, basis: basis, today: data.today)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                content
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
        }
        .background(Theme.background)
        .safeAreaInset(edge: .top, spacing: 0) {
            ProgressView(value: progress).tint(Theme.textPrimary).padding(.horizontal, 20).padding(.bottom, 8)
        }
        .safeAreaInset(edge: .bottom) {
            PinnedActionButton(module == .update ? "Done" : "Next") {
                if module == .update, let update { store.savePlan(update) }
                next()
            }
            .disabled(module == .update && update == nil)
            .padding(.top, 8)
        }
        .detailTitle("Check-In")
        .sheet(isPresented: $loggingWeight) { BodyWeightLogSheet() }
    }

    @ViewBuilder
    private var content: some View {
        let summary = CheckInRules.summary(data.inputs)
        switch module {
        case .weighIn:
            Text("Weigh-In").font(AppFont.title(22))
            Text("\(summary.weighIns) weigh-in\(summary.weighIns == 1 ? "" : "s") from \(StrategyFormat.day(summary.first)) to \(StrategyFormat.day(summary.last)).")
                .font(AppFont.body())
                .foregroundStyle(Theme.textSecondary)
            if summary.weighIns == 0 {
                Text("Log your weight for your next expenditure update.").font(AppFont.body()).foregroundStyle(Theme.amber)
            }
            Button("Log Weight", systemImage: "scalemass") { loggingWeight = true }
                .buttonStyle(.glass)
            StrategyCard(title: "Trend Weight") {
                StrategyStat(value: StrategyFormat.weight(data.inputs.trendWeightKg, data.unit), caption: "Today")
            }
        case .review:
            Text("Review Your Week").font(AppFont.title(22))
            let modules = data.settings.nutrition.coachingModules
            Text(modules.partialLogging && modules.fasting
                ? "Mark days you logged incompletely so they are left out, and days you fasted so they count as zero."
                : modules.partialLogging ? "Mark days you logged incompletely so they are left out." : "Mark days you fasted so they count as zero.")
                .font(AppFont.body(15))
                .foregroundStyle(Theme.textSecondary)
            ForEach((1...7).map { data.today.adding(days: -$0) }.reversed(), id: \.self) { day in
                DayReviewRow(day: day, kcal: data.inputs.intake[day], status: data.inputs.statuses[day] ?? .none, modules: modules)
            }
        case .update:
            Text("Program Update").font(AppFont.title(22))
            if let update, let current = data.current {
                HStack {
                    StrategyStat(value: StrategyFormat.kcal(StrategyRules.averageEnergy(current.targets)), caption: "Previous average")
                    StrategyStat(value: StrategyFormat.kcal(StrategyRules.averageEnergy(update.targets)), caption: "New average")
                }
                WeekTargetsChart(targets: update.targets, today: data.today.weekday)
                HStack {
                    StrategyStat(value: StrategyFormat.kcal(update.expenditureKcal ?? 0), caption: "Expenditure")
                    StrategyStat(value: StrategyFormat.weight(update.trendWeightKg, data.unit), caption: "Trend Weight")
                }
                Text("Your new targets start today and run until your next check-in.").font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
            } else {
                Text("Your program keeps its targets. Manual programs are opted out of automatic weekly plan updates.")
                    .font(AppFont.body())
                    .foregroundStyle(Theme.textSecondary)
            }
        }
    }
}

private struct DayReviewRow: View {
    let day: CalendarDay
    let kcal: Double?
    let status: NutritionDay.Status
    let modules: NutritionSettings.CoachingModules

    @Environment(LocalStore.self) private var store

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(StrategyInputs.date(day, .current).formatted(.dateTime.weekday(.wide).month(.abbreviated).day())).font(AppFont.headline(15))
                Text(kcal.map(StrategyFormat.kcal) ?? "Not counted").font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            Picker("Status", selection: Binding(get: { status }, set: { value in store.updateDay(day) { $0.status = value } })) {
                Text("Complete").tag(NutritionDay.Status.none)
                if modules.partialLogging || status == .partial { Text("Incomplete").tag(NutritionDay.Status.partial) }
                if modules.fasting || status == .fasted { Text("Fasted").tag(NutritionDay.Status.fasted) }
            }
            .pickerStyle(.menu)
            .accessibilityLabel("Status of \(StrategyFormat.day(day))")
        }
        .padding(12)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
    }
}
