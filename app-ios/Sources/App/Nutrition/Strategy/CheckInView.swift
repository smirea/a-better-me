import SwiftUI

/// The weekly check-in: Weigh-In and Review Your Week (MacroFactor's Weigh-In, Partial Logging, and Fasting modules),
/// then Program Update, which writes the `check_in` plan. Fast Check-In skips straight to Program Update.
struct CheckInView: View {
    enum Module: Hashable {
        case weighIn, review, update
    }

    @Environment(\.dismiss) private var dismiss
    @Observe(AppSettings.current) private var settings
    @State private var path: [Module] = []

    private var modules: [Module] { settings.nutrition.fastCheckIn ? [.update] : [.weighIn, .review, .update] }

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
        .navigationTitle("Check-In")
        .navigationBarTitleDisplayMode(.inline)
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
            Text("Mark days you logged incompletely so they are left out, and days you fasted so they count as zero.")
                .font(AppFont.body(15))
                .foregroundStyle(Theme.textSecondary)
            ForEach((1...7).map { data.today.adding(days: -$0) }.reversed(), id: \.self) { day in
                DayReviewRow(day: day, kcal: data.inputs.intake[day], status: data.inputs.statuses[day] ?? .none)
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
                Text("Incomplete").tag(NutritionDay.Status.partial)
                Text("Fasted").tag(NutritionDay.Status.fasted)
            }
            .pickerStyle(.menu)
            .accessibilityLabel("Status of \(StrategyFormat.day(day))")
        }
        .padding(12)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
    }
}

/// MacroFactor's More > Strategy settings: the check-in day, Fast Check-In, and the Standard Floor coached programs
/// respect. Settings can push this page; Strategy's menu does too.
struct CheckInSettingsView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        Form {
            Section {
                Picker("Check-In Day", selection: store.binding(settings, \.nutrition.checkInWeekday)) {
                    ForEach(1...7, id: \.self) { Text(StrategyFormat.weekdayNames[$0 - 1]).tag($0) }
                }
                Toggle("Fast Check-In", isOn: store.binding(settings, \.nutrition.fastCheckIn))
                    .tint(Theme.accent)
            } footer: {
                Text("Coached and collaborative programs update their targets on the check-in day. Fast Check-In skips all optional coaching modules.")
            }
            Section {
                Stepper(value: store.binding(settings, \.nutrition.standardFloorKcal), in: 800...2500, step: 10) {
                    LabeledContent("Standard Floor", value: "\(settings.nutrition.standardFloorKcal) kcal")
                }
            } footer: {
                Text("Coached targets never go below the Standard Floor. The Low Floor is two thirds of it.")
            }
        }
        .themedList()
        .navigationTitle("Check-In Settings")
        .navigationBarTitleDisplayMode(.inline)
    }
}
