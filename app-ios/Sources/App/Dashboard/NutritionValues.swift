import SwiftUI

struct ExpenditureSummary {
    var changes: [NutritionMetrics.Change]
    var currentKcal: Double?
    var strategy: NutritionExpenditure.ExpenditureStrategy?
}

struct WeightTrendSummary {
    var changes: [NutritionMetrics.Change]
    var insights: NutritionMetrics.WeightInsights?
}

/// Intake bars against a reference line over a window, with the mean difference over the days that have both.
struct BalanceValues {
    var interval: DateInterval
    var bars: [DatedValue]
    var line: [DatedValue]
    var meanDifference: Double?
}

enum BalanceReference: String, CaseIterable, Hashable {
    case expenditure = "Expenditure", targets = "Targets"
}

struct FoodLoggingValues {
    var byDay: [CalendarDay: NutritionLogDay]
    var habit: HabitValues
    var streak: Int
    var todayKcal: Double?
    /// Newest first, one heat map each.
    var years: [Int]
}

extension DashboardData {
    var today: CalendarDay { CalendarDay(now, in: calendar) }

    var intake: [DatedValue] { NutritionExpenditure.intake(log, calendar: calendar) }

    var expenditurePoints: [DatedValue] { expenditure.map { DatedValue(date: $0.date, value: $0.kcal) } }

    var energyTargets: [DatedValue] { NutritionMetrics.energyTargets(plans, through: today, calendar: calendar) }

    var goalPlan: NutritionPlan? { NutritionPlan.effective(on: today, in: plans) }

    func computedExpenditure(profile: ProfileSettings) -> [NutritionEngine.ExpenditureDay] {
        NutritionExpenditure.expenditure(
            intake: NutritionExpenditure.intake(log, calendar: calendar), weighIns: weighIns.points, trend: trend,
            settings: expenditureSettings, profile: profile, plans: plans, steps: steps, now: now, calendar: calendar
        )
    }

    func window(days: Int) -> DateInterval {
        let today = calendar.startOfDay(for: now)
        return DateInterval(
            start: calendar.date(byAdding: .day, value: -(days - 1), to: today)!,
            end: calendar.date(byAdding: .day, value: 1, to: today)!
        )
    }

    func balance(_ reference: BalanceReference, days: Int) -> BalanceValues {
        let interval = window(days: days)
        let bars = intake.inside(interval)
        let line = (reference == .expenditure ? expenditurePoints : energyTargets).inside(interval)
        let differences = NutritionMetrics.differences(intake: bars, reference: line, calendar: calendar)
        return BalanceValues(interval: interval, bars: bars, line: line, meanDifference: differences.average)
    }

    var expenditureCard: CardValues {
        let values = expenditure.suffix(7).map(\.kcal)
        return CardValues(values: values, text: values.last?.wholeText)
    }

    /// Today's Food Log summary lines, against the same targets the Food Log fills its columns to.
    func todaySummary(_ columns: [NutrientID], overages: Bool) -> [MacroLine] {
        targets(on: today).summary(log.first { $0.day == today }?.consumed ?? [:], columns: columns, showOverages: overages)
    }

    var foodLogging: FoodLoggingValues {
        let dates = NutritionMetrics.loggedDates(log, calendar: calendar)
        let byDay = Dictionary(log.map { ($0.day, $0) }, uniquingKeysWith: { $1 })
        let year = calendar.component(.year, from: now)
        return FoodLoggingValues(
            byDay: byDay,
            habit: HabitValues(
                days: DashboardMetrics.habitDays(dates, now: now, calendar: calendar),
                text: "\(DashboardMetrics.daysThisWeek(dates, now: now, calendar: calendar))/7"
            ),
            streak: NutritionMetrics.streak(dates, now: now, calendar: calendar),
            todayKcal: byDay[today].map { $0.consumed[.energy] ?? 0 },
            years: Array(((log.first?.day.year ?? year)...year).reversed())
        )
    }

    func balanceTab(_ reference: BalanceReference, title: String, points: [DatedValue], color: Color) -> MetricTab {
        let intake = intake
        let differences = NutritionMetrics.differences(intake: intake, reference: points, calendar: calendar)
        return MetricTab(
            title: title, points: intake, unit: .whole("cal"), seriesTitle: "Calories", averageTitle: "Average", summary: .total, style: .bar,
            color: Theme.calories,
            overlay: MetricTab.Overlay(title: reference.rawValue, points: points, color: color, dashed: true),
            stats: { interval in
                let mean = differences.inside(interval).average
                guard reference == .expenditure else { return [MetricTab.Stat(title: "Average", value: mean)] }
                return [MetricTab.Stat(title: (mean ?? 0) > 0 ? "Surplus" : "Deficit", value: mean.map(abs))]
            },
            balance: reference
        )
    }
}
