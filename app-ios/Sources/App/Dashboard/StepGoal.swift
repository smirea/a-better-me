import SwiftUI

/// The daily step goal and the streaks it makes. A day meets the goal at or above it; an unfinished today joins the
/// streak once it does, and never breaks it before midnight.
enum StepGoal {
    static let defaultGoal = 10_000
    static let choices = Array(stride(from: 1_000, through: 40_000, by: 500))

    /// Pedometer++'s three colors: met, at least half way, and short of half.
    enum Tier: Equatable {
        case met, near, far

        var color: Color {
            switch self {
            case .met: Theme.goal
            case .near: Theme.accent
            case .far: Theme.destructive
            }
        }
    }

    struct Day: Equatable, Identifiable {
        var date: Date
        var steps: Double
        var tier: Tier
        /// Part of the current streak.
        var inStreak: Bool

        var id: Date { date }
    }

    struct Summary: Equatable {
        var goal: Int
        var today: Double
        /// The last seven days, oldest first, today last.
        var week: [Day]
        var streak: Int
        var best: Int
        var metLast30: Int
        var hasSteps: Bool
    }

    static func tier(_ steps: Double, goal: Int) -> Tier {
        steps >= Double(goal) ? .met : steps * 2 >= Double(goal) ? .near : .far
    }

    /// `steps` holds one total per day, dated at the start of the day.
    static func summary(_ steps: [DatedValue], goal: Int, today: Date, calendar: Calendar) -> Summary {
        let start = calendar.startOfDay(for: today)
        var byDay: [Date: Double] = [:]
        for point in steps { byDay[calendar.startOfDay(for: point.date), default: 0] += point.value }
        func day(_ offset: Int) -> Date { calendar.date(byAdding: .day, value: offset, to: start)! }
        func met(_ date: Date) -> Bool { (byDay[date] ?? 0) >= Double(goal) }

        var streak = 0
        var cursor = met(start) ? 0 : -1
        while met(day(cursor)) {
            streak += 1
            cursor -= 1
        }
        let streakDays = Set((0..<streak).map { day(cursor + 1 + $0) })

        var best = 0
        var run = 0
        var previous: Date?
        for date in byDay.keys.sorted() where met(date) {
            run = previous.map { calendar.date(byAdding: .day, value: 1, to: $0) == date } == true ? run + 1 : 1
            best = max(best, run)
            previous = date
        }

        let week = (-6...0).map { offset in
            let date = day(offset)
            let value = byDay[date] ?? 0
            return Day(date: date, steps: value, tier: tier(value, goal: goal), inStreak: streakDays.contains(date))
        }
        return Summary(
            goal: goal, today: byDay[start] ?? 0, week: week, streak: streak, best: best,
            metLast30: (-29...0).count { met(day($0)) }, hasSteps: !byDay.isEmpty
        )
    }
}

/// The top of the Steps screen: today against the goal, and the current streak.
struct StepGoalHeader: View {
    let summary: StepGoal.Summary

    var body: some View {
        let fraction = min(summary.today / Double(summary.goal), 1)
        let remaining = Double(summary.goal) - summary.today
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(summary.today.wholeText).font(AppFont.number(30))
                Text("/ \(Double(summary.goal).wholeText) steps").font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                Spacer(minLength: 0)
                StreakBadge(days: summary.streak)
            }
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.surfaceRaised)
                    Capsule().fill(StepGoal.tier(summary.today, goal: summary.goal).color)
                        .frame(width: max(proxy.size.width * fraction, fraction > 0 ? 10 : 0))
                }
            }
            .frame(height: 10)
            Text(remaining > 0 ? "\(remaining.wholeText) to go today" : "Goal reached today")
                .font(AppFont.rowDetail)
                .foregroundStyle(Theme.textSecondary)
        }
        .card()
        .accessibilityElement(children: .combine)
    }
}

struct StreakBadge: View {
    let days: Int

    var body: some View {
        Label(days == 1 ? "1 day" : "\(days) days", systemImage: "flame.fill")
            .font(AppFont.chip)
            .foregroundStyle(days > 0 ? Theme.goal : Theme.textTertiary)
            .accessibilityLabel("\(days) day streak")
    }
}

/// The last seven days as Pedometer++ draws them: each bar colored by how close it came to the goal, its count above,
/// and a bracket over the days of the current streak.
struct StepWeekBars: View {
    let summary: StepGoal.Summary

    var body: some View {
        let top = max(summary.week.map(\.steps).max() ?? 0, Double(summary.goal), 1)
        VStack(spacing: 6) {
            bracket.frame(height: 22)
            HStack(alignment: .bottom, spacing: 6) {
                ForEach(summary.week) { day in
                    VStack(spacing: 4) {
                        Text(day.steps > 0 ? day.steps.wholeText : "")
                            .font(AppFont.caption(11))
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                        RoundedRectangle(cornerRadius: Theme.tinyCornerRadius)
                            .fill(day.tier.color)
                            .frame(height: max(130 * day.steps / top, day.steps > 0 ? 4 : 0))
                    }
                    .frame(maxWidth: .infinity)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(day.date.formatted(.dateTime.weekday(.wide))), \(day.steps.wholeText) steps")
                }
            }
            .frame(height: 150, alignment: .bottom)
            HStack(spacing: 6) {
                ForEach(summary.week) { day in
                    VStack(spacing: 0) {
                        Text(day.date.formatted(.dateTime.weekday(.abbreviated)).uppercased()).font(AppFont.headline(12))
                        Text(day.date.formatted(.dateTime.day())).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .accessibilityHidden(true)
        }
        .card()
    }

    private var bracket: some View {
        GeometryReader { proxy in
            let indices = summary.week.indices.filter { summary.week[$0].inStreak }
            if let first = indices.first, let last = indices.last {
                let column = (proxy.size.width + 6) / 7
                let left = column * CGFloat(first) + 4
                let right = column * CGFloat(last + 1) - 10
                let mid = proxy.size.height / 2
                Path { path in
                    path.move(to: CGPoint(x: left, y: proxy.size.height))
                    path.addQuadCurve(to: CGPoint(x: left + 6, y: mid), control: CGPoint(x: left, y: mid))
                    path.addLine(to: CGPoint(x: right - 6, y: mid))
                    path.addQuadCurve(to: CGPoint(x: right, y: proxy.size.height), control: CGPoint(x: right, y: mid))
                }
                .stroke(Theme.goal, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                Text(summary.streak == 1 ? "1 day" : "\(summary.streak) days")
                    .font(AppFont.headline(13))
                    .foregroundStyle(Theme.goal)
                    .padding(.horizontal, 6)
                    .background(Theme.surface)
                    .position(x: (left + right) / 2, y: mid)
            }
        }
        .accessibilityHidden(true)
    }
}

/// Below the chart on the Steps screen: the week, then the streak numbers.
struct StepGoalInsights: View {
    let summary: StepGoal.Summary

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader("Last 7 Days")
            StepWeekBars(summary: summary)
            InsightTiles(tiles: [
                InsightTile(
                    value: "\(summary.streak)", unit: summary.streak == 1 ? "day" : "days", title: "Current Streak",
                    text: "Days in a row at \(Double(summary.goal).wholeText) steps or more. Today joins once it gets there."
                ),
                InsightTile(value: "\(summary.best)", unit: summary.best == 1 ? "day" : "days", title: "Best Streak", text: "Your longest run of days at the goal."),
                InsightTile(value: "\(summary.metLast30)", unit: "of 30", title: "Goal Days", text: "Days in the last 30 that reached the goal."),
            ])
        }
    }
}

/// Opened from the Steps screen's toolbar.
struct StepGoalSheet: View {
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var goal: Int

    init(goal: Int) { _goal = State(initialValue: goal) }

    var body: some View {
        NavigationStack {
            Picker("Daily Step Goal", selection: $goal) {
                ForEach(StepGoal.choices, id: \.self) { Text("\(Double($0).wholeText) steps").tag($0) }
            }
            .pickerStyle(.wheel)
            .padding(.horizontal, Theme.margin)
            .navigationTitle("Daily Step Goal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", role: .cancel) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", role: .confirm) {
                        store.updateSettings { $0.profile.dailyStepGoal = goal }
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.height(320)])
    }
}
