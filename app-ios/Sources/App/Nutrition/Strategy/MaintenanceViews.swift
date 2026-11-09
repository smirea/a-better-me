import Feedback
import SwiftUI

enum MaintenanceFormat {
    static func share(_ day: NutritionEngine.Maintenance.IncompleteDay) -> String {
        (day.kcal / day.typicalKcal).formatted(.percent.precision(.fractionLength(0)))
    }

    static func percent(_ share: Double) -> String {
        share.formatted(.percent.precision(.fractionLength(0)))
    }

    static func signedKcal(_ kcal: Double) -> String {
        "\(kcal.rounded().formatted(.number.sign(strategy: .always(includingZero: false)))) kcal"
    }

    static func range(_ period: NutritionEngine.Maintenance.Period) -> String {
        "\(period.start.formatted(.dateTime.month(.abbreviated).day())) – \(period.end.formatted(.dateTime.month(.abbreviated).day().year()))"
    }

    static func reason(_ reason: NutritionEngine.Maintenance.IncompleteReason) -> String {
        switch reason {
        case .farBelowTypical: "Far below your typical intake"
        case .fewEntries: "Light, with few entries"
        case .lowProtein: "Light, with little protein"
        }
    }
}

/// The maintenance a plan's targets are computed from, how it was estimated, and the owner's number in its place.
/// Plan setup and the check-in's Program Update both show it.
struct MaintenanceSection: View {
    let estimate: NutritionEngine.Maintenance.Estimate?
    let isStatic: Bool
    let estimatedKcal: Double?
    @Binding var overrideKcal: Double?
    let unit: WeightUnit

    @State private var showsBreakdown = false
    /// The field's text: only a plausible number replaces the override, so a half-typed or mistyped one (an extra
    /// digit) never plans a week, and the text is not reset to the last good value while the owner types.
    @State private var draft = ""

    private static let plausible = 800.0...6000.0

    private var draftIsPlausible: Bool { Double(draft).map(Self.plausible.contains) ?? false }

    private var summary: String {
        if overrideKcal != nil { return "Set by hand. Your targets are computed from this number." }
        if isStatic { return "Your static expenditure from Settings > Expenditure." }
        guard let estimate else { return "No estimate yet: log your intake and weight, or add your height and birth date to your profile." }
        let periods = estimate.periods.count
        return periods == 0
            ? "From your BMR and activity until your log has a stretch dense enough to measure."
            : "From \(periods) stretch\(periods == 1 ? "" : "es") of your log and weigh-ins, adjusted to your weight and activity today."
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            StrategyCard(title: "Maintenance Calories", subtitle: summary) {
                if let kcal = overrideKcal ?? estimatedKcal {
                    Text(StrategyFormat.kcal(kcal)).font(AppFont.number())
                }
            } actions: {
                if estimate != nil, !isStatic {
                    Button("See the calculation", systemImage: "list.bullet.rectangle") { showsBreakdown = true }
                        .chipButton()
                        .controlSize(.small)
                }
            }
            VStack(spacing: 12) {
                Toggle("Set maintenance by hand", isOn: Binding(
                    get: { overrideKcal != nil },
                    set: { manual in
                        overrideKcal = manual ? (estimatedKcal ?? 2000).rounded() : nil
                        draft = overrideKcal.map { "\(Int($0))" } ?? ""
                    }
                ))
                if overrideKcal != nil {
                    LabeledContent("Maintenance") {
                        HStack(spacing: 4) {
                            TextField("Maintenance", text: $draft)
                            .onChange(of: draft) { _, text in
                                if let kcal = Double(text), Self.plausible.contains(kcal) { overrideKcal = kcal }
                            }
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 100)
                            .accessibilityLabel("Maintenance calories")
                            Text("kcal").foregroundStyle(Theme.textSecondary)
                        }
                    }
                    if !draftIsPlausible {
                        Text("Enter a number from 800 to 6,000 kcal.")
                            .font(AppFont.caption())
                            .foregroundStyle(Theme.amber)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
            .card()
        }
        .onAppear { draft = overrideKcal.map { "\(Int($0))" } ?? "" }
        .sheet(isPresented: $showsBreakdown) {
            if let estimate { MaintenanceBreakdownView(estimate: estimate, unit: unit) }
        }
        .feedback(self)
    }
}

/// How the maintenance estimate was reached: each measured stretch with its coverage, intake, weight change, and
/// adjustments, the prior, and the days left out as incomplete, so the owner can check the number.
struct MaintenanceBreakdownView: View {
    let estimate: NutritionEngine.Maintenance.Estimate
    let unit: WeightUnit

    @Environment(\.dismiss) private var dismiss
    @State private var showsAllExcluded = false

    var body: some View {
        NavigationStack {
            List {
                ThemedSection(footer: "Each stretch below had enough logged days (60% of three weeks) and weigh-ins (six in three weeks) to measure: average intake, less the energy of the weight change. Each is moved to your weight and activity today, then they are averaged, weighting the precise and recent ones more. The first two weeks of a stretch are left out, because weight swings with water when eating changes.") {
                    LabeledContent("Maintenance", value: StrategyFormat.kcal(estimate.kcal))
                    LabeledContent("Uncertainty", value: "± \(StrategyFormat.kcal(estimate.sdKcal))")
                    LabeledContent("Trend weight today", value: StrategyFormat.weight(estimate.weightKg, unit))
                }
                ForEach(estimate.periods.reversed(), id: \.start) { period in
                    ThemedSection(MaintenanceFormat.range(period), subtitle: "\(MaintenanceFormat.percent(period.share)) of the estimate") {
                        LabeledContent("Days logged", value: "\(period.loggedDays) of \(period.days)")
                        LabeledContent("Weigh-ins", value: "\(period.weighIns)")
                        LabeledContent("Average intake", value: StrategyFormat.kcal(period.intakeKcal))
                        LabeledContent("Weight change", value: weightChange(period))
                        LabeledContent("Measured maintenance", value: StrategyFormat.kcal(period.measuredKcal))
                        ForEach(period.adjustments, id: \.kind) { adjustment in
                            LabeledContent {
                                Text(MaintenanceFormat.signedKcal(adjustment.kcal))
                            } label: {
                                Text(adjustmentTitle(adjustment.kind))
                                Text(adjustmentDetail(adjustment))
                            }
                        }
                        LabeledContent("Today", value: "\(StrategyFormat.kcal(period.kcal)) ± \(period.sdKcal.wholeText)")
                            .font(AppFont.rowTitle)
                    }
                }
                if let prior = estimate.prior {
                    ThemedSection(
                        prior.source == .initial ? "Your initial estimate" : "BMR × activity",
                        subtitle: "\(MaintenanceFormat.percent(prior.share)) of the estimate",
                        footer: prior.source == .initial
                            ? "The initial expenditure in Settings > Expenditure, a starting point that measured stretches outweigh."
                            : "From your profile and your Activity and Exercise answers in Settings > Expenditure, a starting point that measured stretches outweigh."
                    ) {
                        LabeledContent("Estimate", value: StrategyFormat.kcal(prior.kcal))
                    }
                }
                if !estimate.incomplete.isEmpty {
                    let excluded = estimate.incomplete.reversed()
                    ThemedSection(
                        "Left out as incomplete",
                        subtitle: "\(excluded.count) day\(excluded.count == 1 ? "" : "s")",
                        footer: "A day far below your typical intake (under 60% of the median of the days around it), or a light day with few entries or little protein, counts as if you had marked it incomplete. Enter its totals in the Nutrition Data Manager to count it."
                    ) {
                        ForEach(Array(excluded.prefix(showsAllExcluded ? excluded.count : 8)), id: \.date) { day in
                            LabeledContent {
                                Text("\(day.kcal.wholeText) of \(StrategyFormat.kcal(day.typicalKcal))")
                            } label: {
                                Text(day.date.formatted(.dateTime.month(.abbreviated).day().year()))
                                Text(MaintenanceFormat.reason(day.reason))
                            }
                        }
                        if excluded.count > 8, !showsAllExcluded {
                            Button("Show all \(excluded.count)") { showsAllExcluded = true }
                        }
                    }
                }
            }
            .themedList()
            .detailTitle("Maintenance")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
            }
        }
        .feedback(self)
    }

    private func weightChange(_ period: NutritionEngine.Maintenance.Period) -> String {
        let total = unit.fromKg(period.weightChangeKg)
        let weekly = total / Double(period.days) * 7
        let digits = 0...1
        return "\(StrategyFormat.signed(total, digits: digits)) \(unit.rawValue) (\(StrategyFormat.signed(weekly, digits: 0...2))/wk)"
    }

    private func adjustmentTitle(_ kind: NutritionEngine.Maintenance.Adjustment.Kind) -> String {
        switch kind {
        case .weight: "Weight"
        case .steps: "Steps"
        case .workouts: "Workouts"
        }
    }

    private func adjustmentDetail(_ adjustment: NutritionEngine.Maintenance.Adjustment) -> String {
        switch adjustment.kind {
        case .weight:
            "\(StrategyFormat.weight(adjustment.before, unit)) then, \(StrategyFormat.weight(adjustment.now, unit)) now"
        case .steps:
            "\(adjustment.before.wholeText) a day then, \(adjustment.now.wholeText) over the last 4 weeks"
        case .workouts:
            "\(adjustment.before.formatted(.number.precision(.fractionLength(1)))) a week then, \(adjustment.now.formatted(.number.precision(.fractionLength(1)))) over the last 4 weeks"
        }
    }
}
