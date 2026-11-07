import HealthKit
import os
import SwiftUI
import WidgetKit

/// Pedometer++'s ring: today against the goal, a walking figure in the middle on the Lock Screen.
struct StepsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WidgetKind.steps, provider: StepsProvider()) { entry in
            StepsTodayView(summary: entry.summary).stepsWidgetChrome()
        }
        .configurationDisplayName("Steps")
        .description("Today's steps against your daily goal.")
        .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

/// Pedometer++'s week: the last seven days colored by how close each came to the goal.
struct StepsWeekWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WidgetKind.stepsWeek, provider: StepsProvider()) { entry in
            StepsWeekView(summary: entry.summary).stepsWidgetChrome()
        }
        .configurationDisplayName("Steps This Week")
        .description("The last seven days of steps and your streak.")
        .supportedFamilies([.systemMedium, .accessoryRectangular])
    }
}

struct StepsEntry: TimelineEntry {
    let date: Date
    let summary: StepGoal.Summary
}

/// Health's own counts for the last month and the phone's pedometer for today, merged over the app's snapshot. Health
/// stays readable only while the phone is unlocked, so a locked refresh starts from the last refresh's days and leans
/// on the pedometer, which keeps counting. The next refresh comes sooner while the owner moves (`StepsCadence`).
struct StepsProvider: TimelineProvider {
    private static let store = HKHealthStore()
    private static let log = Logger(subsystem: "com.stefan.a-better-me", category: "widgets")

    func placeholder(in context: Context) -> StepsEntry { .sample }

    func getSnapshot(in context: Context, completion: @escaping @Sendable (StepsEntry) -> Void) {
        guard !context.isPreview else { return completion(.sample) }
        Task { completion(await Self.timeline(now: .now).entries[0]) }
    }

    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<StepsEntry>) -> Void) {
        Task { completion(await Self.timeline(now: .now)) }
    }

    /// Now, then midnight, which starts the new day at zero if the next refresh runs late.
    static func timeline(now: Date, calendar: Calendar = .current) async -> Timeline<StepsEntry> {
        let snapshot = StepsSnapshot.load() ?? StepsSnapshot(goal: StepGoal.defaultGoal, days: [:])
        let previous = StepsReading.load()
        let today = calendar.startOfDay(for: now)
        async let fresh = health(now: now, calendar: calendar)
        async let phoneToday = PhonePedometer.steps(from: today, to: now)
        async let phoneRecent = PhonePedometer.steps(from: now.addingTimeInterval(-StepsCadence.recentWindow), to: now)
        let live = StepsReading.days(previous: previous?.days ?? [], health: await fresh ?? [], phoneToday: await phoneToday, today: today, calendar: calendar)
        let midnight = calendar.date(byAdding: .day, value: 1, to: today)!
        let entries = [now, midnight].map { StepsEntry(date: $0, summary: snapshot.summary(live: live, now: $0, calendar: calendar)) }
        let reading = StepsReading(date: now, days: live, today: entries[0].summary.today)
        do {
            try reading.save()
        } catch {
            log.error("Saving the steps widget's read failed: \(String(describing: error))")
        }
        let recent = await phoneRecent
        let interval = StepsCadence.interval(recentPhoneSteps: recent, previous: previous, current: reading)
        log.info("Steps widget shows \(reading.today) steps, \(recent.map { "\($0)" } ?? "no pedometer") in the last 10 minutes, and refreshes in \(interval) s")
        return Timeline(entries: entries, policy: .after(now.addingTimeInterval(interval)))
    }

    /// Nil when Health can't be read, as while the phone is locked.
    private static func health(now: Date, calendar: Calendar) async -> [DatedValue]? {
        guard HKHealthStore.isHealthDataAvailable() else { return nil }
        do {
            let start = calendar.date(byAdding: .day, value: -29, to: now)!
            return try await store.dailySums(of: HKQuantityType(.stepCount), unit: .count(), from: start, through: now, calendar: calendar)
        } catch {
            log.info("Steps widget read no Health data: \(String(describing: error))")
            return nil
        }
    }
}

extension StepsEntry {
    /// The gallery's week: a streak that today has already joined.
    static let sample: StepsEntry = {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: .now)
        let counts: [Double] = [7392, 9733, 7611, 3041, 10542, 15423, 6208]
        let steps = counts.enumerated().map { offset, value in
            DatedValue(date: calendar.date(byAdding: .day, value: offset - 6, to: today)!, value: value)
        }
        return StepsEntry(date: .now, summary: StepGoal.summary(steps, goal: StepGoal.defaultGoal, today: .now, calendar: calendar))
    }()
}

private struct StepsTodayView: View {
    let summary: StepGoal.Summary
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryInline:
            Label("\(summary.today.wholeText) steps", systemImage: "figure.walk")
        case .accessoryCircular:
            StepsRing(fraction: summary.fraction, color: .primary, track: .primary.opacity(0.3), lineWidth: 7) {
                Image(systemName: "figure.walk").font(.system(size: 22, weight: .semibold))
            }
            .accessibilityLabel("\(summary.today.wholeText) of \(Double(summary.goal).wholeText) steps")
        case .accessoryRectangular:
            HStack(spacing: 8) {
                StepsRing(fraction: summary.fraction, color: .primary, track: .primary.opacity(0.3), lineWidth: 4) {
                    Image(systemName: "figure.walk").font(.system(size: 13, weight: .semibold))
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 0) {
                    Text(summary.today.wholeText).font(AppFont.number(20)).widgetAccentable()
                    Text(summary.remainingLabel).font(AppFont.caption(13)).foregroundStyle(.secondary)
                }
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        default:
            if summary.hasSteps {
                VStack(spacing: 6) {
                    StepsRing(fraction: summary.fraction, color: summary.todayTier.color, track: summary.todayTier.color.opacity(0.22), lineWidth: 10) {
                        VStack(spacing: 0) {
                            Image(systemName: "figure.walk")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(summary.todayTier.color)
                            Text(summary.today.wholeText)
                                .font(AppFont.number(22))
                                .minimumScaleFactor(0.5)
                                .lineLimit(1)
                            Text("of \(Double(summary.goal).wholeText)")
                                .font(AppFont.caption(11))
                                .foregroundStyle(Theme.textSecondary)
                                .lineLimit(1)
                        }
                    }
                    StreakLabel(days: summary.streak)
                }
            } else {
                StepsNotice()
            }
        }
    }
}

private struct StepsWeekView: View {
    let summary: StepGoal.Summary
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Label(summary.today.wholeText, systemImage: "figure.walk")
                    .font(AppFont.headline(14))
                    .widgetAccentable()
                StepBars(summary: summary, spacing: 3, labels: false)
            }
        default:
            if summary.hasSteps {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .firstTextBaseline) {
                        Label(summary.today.wholeText, systemImage: "figure.walk")
                            .font(AppFont.number(20))
                            .foregroundStyle(summary.todayTier.color)
                        Text(summary.remainingLabel)
                            .font(AppFont.caption(12))
                            .foregroundStyle(Theme.textSecondary)
                        Spacer(minLength: 4)
                        StreakLabel(days: summary.streak)
                    }
                    .lineLimit(1)
                    StepBars(summary: summary, spacing: 6, labels: true)
                }
            } else {
                StepsNotice()
            }
        }
    }
}

/// The week's bars against the goal's dashed line; on the Lock Screen, met days are solid and the rest faint.
private struct StepBars: View {
    let summary: StepGoal.Summary
    let spacing: CGFloat
    let labels: Bool
    @Environment(\.widgetRenderingMode) private var renderingMode

    var body: some View {
        let top = max(summary.week.map(\.steps).max() ?? 0, Double(summary.goal), 1)
        VStack(spacing: 3) {
            GeometryReader { proxy in
                ZStack(alignment: .bottom) {
                    HStack(alignment: .bottom, spacing: spacing) {
                        ForEach(summary.week) { day in
                            RoundedRectangle(cornerRadius: 3)
                                .fill(color(day))
                                .frame(height: max(proxy.size.height * day.steps / top, day.steps > 0 ? 3 : 0))
                                .frame(maxWidth: .infinity)
                        }
                    }
                    Path { path in
                        let y = proxy.size.height * (1 - Double(summary.goal) / top)
                        path.move(to: CGPoint(x: 0, y: y))
                        path.addLine(to: CGPoint(x: proxy.size.width, y: y))
                    }
                    .stroke(.secondary, style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                }
            }
            if labels {
                HStack(spacing: spacing) {
                    ForEach(summary.week) { day in
                        Text(day.date.formatted(.dateTime.weekday(.narrow)))
                            .font(AppFont.caption(11))
                            .foregroundStyle(Theme.textSecondary)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(summary.week.map { "\($0.date.formatted(.dateTime.weekday(.wide))) \($0.steps.wholeText)" }.joined(separator: ", "))
    }

    private func color(_ day: StepGoal.Day) -> Color {
        guard renderingMode == .fullColor else { return day.tier == .met ? .primary : .primary.opacity(0.4) }
        return day.tier.color
    }
}

private struct StepsRing<Label: View>: View {
    let fraction: Double
    let color: Color
    let track: Color
    let lineWidth: CGFloat
    @ViewBuilder var label: Label

    var body: some View {
        ZStack {
            Circle().stroke(track, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: fraction)
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .widgetAccentable()
            label.padding(lineWidth)
        }
        .padding(lineWidth / 2)
    }
}

private struct StreakLabel: View {
    let days: Int

    var body: some View {
        Label(days == 1 ? "1 day" : "\(days) days", systemImage: "flame.fill")
            .font(AppFont.caption(12))
            .foregroundStyle(days > 0 ? Theme.goal : Theme.textTertiary)
            .accessibilityLabel("\(days) day streak")
    }
}

private struct StepsNotice: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Image(systemName: "figure.walk").foregroundStyle(Theme.accent)
            Text("Open A Better Me and allow Health to count your steps.")
                .font(AppFont.caption(13))
                .foregroundStyle(Theme.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private extension StepGoal.Summary {
    var fraction: Double { min(today / Double(max(goal, 1)), 1) }
    var todayTier: StepGoal.Tier { StepGoal.tier(today, goal: goal) }
    var remainingLabel: String {
        let remaining = Double(goal) - today
        return remaining > 0 ? "\(remaining.wholeText) to go" : "Goal reached"
    }
}

private extension View {
    func stepsWidgetChrome() -> some View {
        foregroundStyle(Theme.textPrimary)
            .containerBackground(Theme.background, for: .widget)
            .widgetURL(QuickAction.steps.url)
    }
}
