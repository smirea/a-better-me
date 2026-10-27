import SwiftUI

/// Every visible nutrient against its target for the day, or as a daily average over the week, month, three months,
/// or year that ends on it. Today can list each nutrient's top three contributors.
struct NutritionOverview: View {
    enum Period: Int, CaseIterable, Identifiable {
        case today = 1, week = 7, month = 30, quarter = 90, year = 365

        var id: Self { self }

        var title: String {
            switch self {
            case .today: "Today"
            case .week: "1 Week"
            case .month: "1 Month"
            case .quarter: "3 Months"
            case .year: "1 Year"
            }
        }
    }

    let day: CalendarDay

    @State private var period = Period.today
    @State private var contributors = false

    var body: some View {
        OverviewList(day: day, period: period, contributors: period == .today && contributors)
            .id(period)
            .safeAreaInset(edge: .top) {
                VStack(spacing: 10) {
                    Picker("Period", selection: $period) {
                        ForEach(Period.allCases) { Text($0.title).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    if period == .today {
                        Toggle("Contributors", isOn: $contributors).tint(Theme.accent)
                    }
                }
                .padding(.horizontal, Theme.margin)
                .padding(.bottom, 8)
                .background(Theme.background)
            }
            .detailTitle("Nutrition Overview")
    }
}

private struct OverviewList: View {
    let day: CalendarDay
    let period: NutritionOverview.Period
    let contributors: Bool

    @Observe(AppSettings.current) private var settings
    @Observe(NutritionPlan.all) private var plans
    @Observe(NutrientGoal.all) private var goals
    @Observe(BodyWeight.latest) private var weight
    @Observe private var entries: [FoodEntry]
    @Observe private var rows: [NutritionDay]

    init(day: CalendarDay, period: NutritionOverview.Period, contributors: Bool) {
        self.day = day
        self.period = period
        self.contributors = contributors
        let start = day.adding(days: 1 - period.rawValue)
        _entries = Observe(FoodEntry.between(start, day))
        _rows = Observe(NutritionDay.between(start, day))
    }

    var body: some View {
        let days = (0..<period.rawValue).map { day.adding(days: -$0) }
        let amounts = period == .today ? (rows.first { $0.id == day } ?? NutritionDay(id: day)).totals(entries) : FoodLog.dailyAverage(entries, rows: rows, days: days)
        let targets = NutrientTargets(
            target: NutritionPlan.effective(on: day, in: plans)?.target(on: day), goals: goals, day: day,
            sex: settings.profile.sex, weightKg: weight?.weightKg ?? settings.profile.bodyWeightKg
        )
        List {
            ForEach(settings.nutrition.hideAdditionalNutrients ? [.macros] : NutrientSection.allCases) { section in
                ThemedSection(section.rawValue) {
                    ForEach(section.nutrients) { nutrient in
                        let row = NutrientRow(
                            nutrient: nutrient, value: amounts.amount(of: nutrient.id) ?? 0, range: targets.range(nutrient.id),
                            contributors: contributors ? FoodLog.contributors(entries, of: nutrient.id, limit: 3) : nil
                        )
                        if contributors {
                            NavigationLink(value: FoodLogRoute.contributors(day, nutrient.id)) { row }
                        } else {
                            row
                        }
                    }
                }
            }
        }
        .themedList()
    }
}

/// Every food that gave the day some of a nutrient, largest first.
struct ContributorsView: View {
    let day: CalendarDay
    let nutrient: NutrientID

    @Observe private var entries: [FoodEntry]

    init(day: CalendarDay, nutrient: NutrientID) {
        self.day = day
        self.nutrient = nutrient
        _entries = Observe(FoodEntry.on(day))
    }

    var body: some View {
        let info = NutrientRegistry.nutrient(nutrient)
        List {
            ThemedSection {
                ForEach(FoodLog.contributors(entries, of: nutrient)) { contributor in
                    LabeledContent(contributor.name, value: info.map { NutritionFormat.amount(contributor.amount, $0.unit) } ?? NutritionFormat.amount(contributor.amount))
                        .monospacedDigit()
                }
            }
        }
        .themedList()
        .overlay {
            if FoodLog.contributors(entries, of: nutrient).isEmpty {
                ContentUnavailableView("No Contributors", systemImage: "fork.knife")
            }
        }
        .detailTitle(info?.name ?? "Contributors")
    }
}
