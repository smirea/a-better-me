import SwiftUI

struct ExpenditureSummary {
    var changes: [NutritionMetrics.Change]
    var currentKcal: Double?
    var strategy: NutritionMetrics.ExpenditureStrategy?
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
    /// The means of intake and of the reference over the same paired days, so intake − reference = difference.
    var meanIntake: Double?
    var meanReference: Double?
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

    var intake: [DatedValue] { NutritionMetrics.intake(log, calendar: calendar) }

    var expenditurePoints: [DatedValue] { expenditure.map { DatedValue(date: $0.date, value: $0.kcal) } }

    var energyTargets: [DatedValue] { NutritionMetrics.energyTargets(plans, through: today, calendar: calendar) }

    var goalPlan: NutritionPlan? { NutritionPlan.effective(on: today, in: plans) }

    func computedExpenditure(profile: ProfileSettings) -> [NutritionEngine.ExpenditureDay] {
        NutritionMetrics.expenditure(
            log: log, weighIns: weighIns.map { DatedValue(date: $0.date, value: $0.kg) }, trend: trend,
            settings: nutritionSettings.expenditure, profile: profile, now: now, calendar: calendar
        )
    }

    /// The `days` days ending today.
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
        let paired = Set(differences.map(\.date))
        let meanDifference = differences.average
        let meanIntake = paired.isEmpty ? bars.average : bars.filter { paired.contains($0.date) }.average
        return BalanceValues(
            interval: interval, bars: bars, line: line, meanDifference: meanDifference, meanIntake: meanIntake,
            meanReference: meanDifference.flatMap { difference in meanIntake.map { $0 - difference } } ?? line.average
        )
    }

    var expenditureCard: CardValues {
        let values = expenditure.suffix(7).map(\.kcal)
        return CardValues(values: values, text: values.last.map { Int($0.rounded()).formatted() })
    }

    var week: [NutritionMetrics.DayNutrition] { NutritionMetrics.week(of: today, log: log, plans: plans) }

    var todayNutrition: NutritionMetrics.DayNutrition { NutritionMetrics.day(today, log: log, plans: plans) }

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

    /// Intake bars against a dashed reference, with the range's mean difference as the one stat.
    func balanceTab(_ title: String, icon: String, reference: [DatedValue], color: Color) -> MetricTab {
        let intake = intake
        let differences = NutritionMetrics.differences(intake: intake, reference: reference, calendar: calendar)
        let isExpenditure = title == "Expenditure"
        return MetricTab(
            title: title, icon: icon, points: intake, unit: "kcal", seriesTitle: "Calories", averageTitle: "Average", summary: .total, style: .bar,
            color: DashboardColor.energy,
            overlay: MetricTab.Overlay(title: isExpenditure ? "Expenditure" : "Targets", points: reference, color: color, dashed: true),
            stats: { interval in
                let mean = differences.inside(interval).average
                guard isExpenditure else { return [MetricTab.Stat(title: "Average", value: mean)] }
                return [MetricTab.Stat(title: (mean ?? 0) > 0 ? "Surplus" : "Deficit", value: mean.map(abs))]
            }
        )
    }
}
