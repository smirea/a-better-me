import SwiftUI

/// Finished sessions by day, for the week strip and the month calendar. Weeks start on Monday, as in the reference.
struct LoggedDays {
    static let calendar: Calendar = {
        var calendar = Calendar.current
        calendar.firstWeekday = 2
        return calendar
    }()

    private let byDay: [Date: [WorkoutSession]]

    init(_ sessions: [WorkoutSession]) {
        byDay = Dictionary(grouping: sessions) { Self.calendar.startOfDay(for: $0.startedAt) }
    }

    /// The day's last session. The reference opens one summary per day.
    func session(on day: Date) -> WorkoutSession? { byDay[day]?.max { $0.startedAt < $1.startedAt } }

    /// Week starts from the first logged week (at least `minimumBack` weeks ago) to `ahead` weeks from now.
    func weeks(minimumBack: Int, ahead: Int) -> [Date] {
        let calendar = Self.calendar
        let thisWeek = Self.weekStart(of: .now)
        let back = calendar.date(byAdding: .weekOfYear, value: -minimumBack, to: thisWeek)!
        let first = min(back, byDay.keys.min().map(Self.weekStart) ?? back)
        let last = calendar.date(byAdding: .weekOfYear, value: ahead, to: thisWeek)!
        return Array(sequence(first: first) { calendar.date(byAdding: .weekOfYear, value: 1, to: $0) }.prefix { $0 <= last })
    }

    static func weekStart(of date: Date) -> Date {
        calendar.dateInterval(of: .weekOfYear, for: date)!.start
    }

    static func days(from weekStart: Date) -> [Date] {
        (0..<7).map { calendar.date(byAdding: .day, value: $0, to: weekStart)! }
    }
}

/// What tapping a day pill opens.
enum DayPillTarget: Hashable {
    case summary(WorkoutSession)
    case programDay(ProgramRoute)

    /// A logged day opens its summary. Today and the rest of this week, unlogged, open the day a seven-day `program`
    /// trains on that weekday, when it is a workout day. Anything else opens nothing.
    static func of(_ day: Date, session: WorkoutSession?, program: Program?, now: Date, calendar: Calendar) -> DayPillTarget? {
        if let session { return .summary(session) }
        guard let program, day >= calendar.startOfDay(for: now),
              let week = calendar.dateInterval(of: .weekOfYear, for: now), day < week.end,
              let programDay = program.weekdayDay(on: day, calendar: calendar), programDay.templateID != nil
        else { return nil }
        return .programDay(ProgramRoute(programID: program.id, dayID: programDay.id))
    }
}

/// The active program's ring on today's pill: the cycle's completion in the program color.
struct DayPillProgress {
    var fraction: Double
    var color: Color
}

/// Seven day pills, Monday to Sunday, swiped a week at a page. Off the current week, a round chevron jumps back.
struct WeekStrip: View {
    let days: LoggedDays
    var progress: DayPillProgress?
    let target: (Date) -> DayPillTarget?
    let onOpen: (DayPillTarget) -> Void

    @State private var visibleWeek: Date? = LoggedDays.weekStart(of: .now)
    private let thisWeek = LoggedDays.weekStart(of: .now)

    var body: some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: 0) {
                ForEach(days.weeks(minimumBack: 12, ahead: 12), id: \.self) { start in
                    HStack(spacing: 0) {
                        ForEach(LoggedDays.days(from: start), id: \.self) { day in
                            DayPill(day: day, session: days.session(on: day), progress: progress, target: target(day), onOpen: onOpen)
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .containerRelativeFrame(.horizontal)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollPosition(id: $visibleWeek)
        .scrollIndicators(.hidden)
        .overlay(alignment: .trailing) {
            if let visibleWeek, visibleWeek != thisWeek {
                Button("This Week", systemImage: visibleWeek < thisWeek ? "chevron.right" : "chevron.left") {
                    withAnimation { self.visibleWeek = thisWeek }
                }
                .labelStyle(.iconOnly)
                .buttonStyle(.glass)
                .buttonBorderShape(.circle)
            }
        }
    }
}

/// The calendar button's scrolling month grid. Months alternate shades and their first day carries a month chip.
struct MonthCalendar: View {
    let days: LoggedDays
    var progress: DayPillProgress?
    let target: (Date) -> DayPillTarget?
    let onOpen: (DayPillTarget) -> Void

    @State private var position: Date? = LoggedDays.weekStart(of: .now)

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(days.weeks(minimumBack: 26, ahead: 26), id: \.self) { start in
                    HStack(spacing: 0) {
                        ForEach(LoggedDays.days(from: start), id: \.self) { day in
                            DayPill(day: day, session: days.session(on: day), progress: progress, target: target(day), onOpen: onOpen)
                                .padding(.vertical, 10)
                                .frame(maxWidth: .infinity)
                                .background(Self.shade(day))
                                .overlay(alignment: .top) {
                                    if LoggedDays.calendar.component(.day, from: day) == 1 { MonthChip(day: day) }
                                }
                        }
                    }
                }
            }
            .scrollTargetLayout()
        }
        .scrollPosition(id: $position, anchor: .center)
    }

    private static func shade(_ day: Date) -> Color {
        LoggedDays.calendar.component(.month, from: day).isMultiple(of: 2) ? Theme.background : Theme.surface
    }
}

private struct MonthChip: View {
    let day: Date

    var body: some View {
        let calendar = LoggedDays.calendar
        let month = day.formatted(.dateTime.month(.abbreviated))
        let sameYear = calendar.component(.year, from: day) == calendar.component(.year, from: .now)
        Text(sameYear ? month : "\(month) '\(day.formatted(.dateTime.year(.twoDigits)))")
            .font(AppFont.medium(11))
            .padding(.horizontal, 8)
            .background(Theme.surfaceRaised, in: Capsule())
            .offset(y: -7)
    }
}

/// A day number over its weekday initials. Logged days get an amber outline, today a dot and the program's progress
/// ring.
private struct DayPill: View {
    let day: Date
    let session: WorkoutSession?
    let progress: DayPillProgress?
    let target: DayPillTarget?
    let onOpen: (DayPillTarget) -> Void

    var body: some View {
        let isToday = LoggedDays.calendar.isDateInToday(day)
        Button {
            if let target { onOpen(target) }
        } label: {
            VStack(spacing: 0) {
                Text(day.formatted(.dateTime.day())).font(AppFont.headline(14))
                Text(day.formatted(.dateTime.weekday(.short)))
                    .font(AppFont.caption(11))
                    .foregroundStyle(Theme.textSecondary)
                Circle()
                    .fill(isToday ? Theme.textPrimary : .clear)
                    .frame(width: 4, height: 4)
                    .padding(.top, 2)
            }
            .frame(width: 40, height: 60)
            .overlay {
                Capsule().strokeBorder(session == nil ? Theme.textTertiary : Theme.amber, lineWidth: session == nil ? 1 : 2)
            }
            .overlay {
                if isToday, let progress, progress.fraction > 0 {
                    Capsule()
                        .inset(by: 1)
                        .trim(from: 0, to: progress.fraction)
                        .stroke(progress.color, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(day.formatted(date: .abbreviated, time: .omitted))
        .accessibilityValue(isToday ? progress.map { "Program \(Int(($0.fraction * 100).rounded())) percent done" } ?? "" : "")
        .accessibilityHint(hint)
    }

    private var hint: String {
        switch target {
        case .summary: "Opens the workout summary"
        case .programDay: "Opens the program day"
        case nil: ""
        }
    }
}
