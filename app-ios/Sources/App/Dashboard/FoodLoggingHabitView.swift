import SwiftUI

/// MacroFactor's Food Logging habit page: today, the streak, a month of day rings, and one heat map per year.
/// Tapping a day opens its Nutrition Data entry.
struct FoodLoggingHabitView: View {
    @Environment(NutritionData.self) private var nutrition
    private var values = DashboardValues()
    @State private var month: Date?
    @State private var editing: EditedDay?

    private var calendar: Calendar { values.context.calendar }
    private var now: Date { values.context.today }
    private var today: CalendarDay { CalendarDay(now, in: calendar) }

    var body: some View {
        let habit = values.foodLogging
        let byDay = habit.byDay
        let shown = month ?? calendar.dateInterval(of: .month, for: now)!.start
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(spacing: 16) {
                    HStack(alignment: .top) {
                        stat("Today", habit.todayKcal.map { Int($0.rounded()).formatted() } ?? "--", "kcal")
                        Spacer()
                        stat("Streak", habit.streak.formatted(), "days")
                        Spacer()
                    }
                    monthGrid(shown, byDay: byDay)
                    HStack {
                        Button("Previous Month", systemImage: "chevron.backward") { step(shown, by: -1) }
                        Button("Next Month", systemImage: "chevron.forward") { step(shown, by: 1) }
                            .disabled(calendar.isDate(shown, equalTo: now, toGranularity: .month))
                        Spacer()
                        Text(shown.formatted(.dateTime.month(.wide).year())).font(AppFont.medium(15))
                    }
                    .labelStyle(.iconOnly)
                    .buttonStyle(.glass)
                }
                .padding(14)
                .background(Theme.surface, in: .rect(cornerRadius: Theme.cornerRadius))
                legend
                ForEach(habit.years, id: \.self) { year in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(String(year)).font(AppFont.title())
                        YearHeatMap(year: year, states: byDay, calendar: calendar)
                            .padding(10)
                            .background(Theme.surface, in: .rect(cornerRadius: Theme.cornerRadius))
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 30)
        }
        .background(Theme.background)
        .navigationTitle("Food Logging")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $editing) { NutritionDayEntrySheet(day: $0.day, log: nutrition.log) }
    }

    private func stat(_ title: String, _ value: String, _ unit: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(value).font(AppFont.number(22))
                Text(unit).font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func step(_ shown: Date, by months: Int) {
        month = calendar.date(byAdding: .month, value: months, to: shown)
    }

    /// Monday-first weeks, as MacroFactor's calendar.
    private func monthGrid(_ month: Date, byDay: [CalendarDay: NutritionLogDay]) -> some View {
        let first = CalendarDay(month, in: calendar)
        let lead = first.weekday - 1
        let count = calendar.range(of: .day, in: .month, for: month)!.count
        let cells: [CalendarDay?] = Array(repeating: nil, count: lead) + (0..<count).map { first.adding(days: $0) }
        return VStack(spacing: 8) {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 7), spacing: 8) {
                ForEach(Array(cells.enumerated()), id: \.offset) { _, day in
                    if let day {
                        dayCell(day, state: NutritionMetrics.logState(byDay[day]))
                    } else {
                        Color.clear.frame(height: 38)
                    }
                }
            }
            HStack(spacing: 6) {
                ForEach(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], id: \.self) {
                    Text($0).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary).frame(maxWidth: .infinity)
                }
            }
        }
    }

    private func dayCell(_ day: CalendarDay, state: NutritionMetrics.LogState) -> some View {
        let future = day > today
        return Button { editing = EditedDay(day: day) } label: {
            Text("\(day.day)")
                .font(day == today ? AppFont.headline(14) : AppFont.body(14))
                .foregroundStyle(future ? Theme.textTertiary : Theme.textPrimary)
                .frame(width: 38, height: 38)
                .overlay {
                    switch state {
                    case .tracked: Circle().stroke(Theme.calories, lineWidth: 2)
                    case .fasting: Circle().stroke(Theme.calories, style: StrokeStyle(lineWidth: 2, dash: [3, 3]))
                    case .untracked: Circle().stroke(Theme.surfaceRaised, lineWidth: 1.5)
                    }
                }
        }
        .buttonStyle(.plain)
        .disabled(future)
        .accessibilityLabel(day.date(in: calendar).formatted(.dateTime.month(.wide).day()))
        .accessibilityValue(state.title)
    }

    private var legend: some View {
        HStack(spacing: 20) {
            Label { Text("Tracked") } icon: { Image(systemName: "circle").foregroundStyle(Theme.calories) }
            Label { Text("Fasting") } icon: { Image(systemName: "circle.dashed").foregroundStyle(Theme.calories) }
            Label { Text("Untracked") } icon: { Image(systemName: "circle").foregroundStyle(Theme.textTertiary) }
        }
        .font(AppFont.medium(14))
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Theme.surface, in: .rect(cornerRadius: Theme.smallCornerRadius))
    }
}

private struct EditedDay: Identifiable {
    var day: CalendarDay
    var id: CalendarDay { day }
}

extension NutritionMetrics.LogState {
    var title: String {
        switch self {
        case .tracked: "Tracked"
        case .fasting: "Fasting"
        case .untracked: "Untracked"
        }
    }
}

/// A GitHub-style year: one column per week, Monday at the top.
private struct YearHeatMap: View {
    let year: Int
    let states: [CalendarDay: NutritionLogDay]
    let calendar: Calendar

    var body: some View {
        Canvas { context, size in
            let first = CalendarDay("\(year)-01-01")!
            let lead = first.weekday - 1
            let days = calendar.range(of: .day, in: .year, for: first.date(in: calendar))!.count
            let columns = (lead + days + 6) / 7
            let cell = min(size.width / CGFloat(columns), size.height / 7)
            for offset in 0..<days {
                let day = first.adding(days: offset)
                let slot = lead + offset
                let rect = CGRect(x: CGFloat(slot / 7) * cell, y: CGFloat(slot % 7) * cell, width: cell - 1.5, height: cell - 1.5)
                let color = switch NutritionMetrics.logState(states[day]) {
                case .tracked: Theme.calories
                case .fasting: Theme.calories.opacity(0.45)
                case .untracked: Theme.surfaceRaised
                }
                context.fill(Path(roundedRect: rect, cornerRadius: 1.5), with: .color(color))
            }
        }
        .frame(height: 50)
        .accessibilityLabel("\(year) food logging")
    }
}
