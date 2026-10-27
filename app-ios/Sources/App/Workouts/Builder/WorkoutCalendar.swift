import SwiftUI

/// Finished sessions by day, for the week strip and the month calendar.
struct LoggedDays {
    private let byDay: [CalendarDay: [WorkoutSession]]

    init(_ sessions: [WorkoutSession]) {
        byDay = Dictionary(grouping: sessions) { CalendarDay($0.startedAt) }
    }

    /// The day's last session. The reference opens one summary per day.
    func session(on day: CalendarDay) -> WorkoutSession? { byDay[day]?.max { $0.startedAt < $1.startedAt } }

    /// Week offsets from this week: back to the first logged week, at least `minimumBack`, and `ahead` weeks on.
    func weeks(minimumBack: Int, ahead: Int) -> ClosedRange<Int> {
        let thisWeek = CalendarDay.today.monday
        let first = byDay.keys.min().map { thisWeek.days(to: $0.monday) / 7 } ?? 0
        return min(-minimumBack, first)...ahead
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

/// A workout day's pill: today fills with the active program's cycle, and any other logged day's outline is full in
/// amber.
struct WorkoutDayPill: View {
    let day: CalendarDay
    let isLogged: Bool
    let program: DayRing?
    let target: DayPillTarget?
    let onOpen: (DayPillTarget) -> Void

    var body: some View {
        DayPill(day: day, ring: ring) {
            if let target { onOpen(target) }
        }
        .accessibilityValue(day == .today ? program.map { "Program \(Int(($0.fraction * 100).rounded())) percent done" } ?? "" : "")
        .accessibilityHint(hint)
    }

    private var ring: DayRing? {
        if day == .today, let program { return program }
        return isLogged ? DayRing(fraction: 1, color: Theme.amber) : nil
    }

    private var hint: String {
        switch target {
        case .summary: "Opens the workout summary"
        case .programDay: "Opens the program day"
        case nil: ""
        }
    }
}

/// The calendar button's scrolling month grid. Months alternate shades and their first day carries a month chip.
struct MonthCalendar<Pill: View>: View {
    let weeks: ClosedRange<Int>
    @ViewBuilder let pill: (CalendarDay) -> Pill

    @State private var origin = CalendarDay.today.monday
    @State private var position: Int? = 0

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(weeks, id: \.self) { offset in
                    HStack(spacing: 0) {
                        ForEach(origin.adding(days: offset * 7).week, id: \.self) { day in
                            pill(day)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 10)
                                .background(day.month.isMultiple(of: 2) ? Theme.background : Theme.surface)
                                .overlay(alignment: .top) {
                                    if day.day == 1 { MonthChip(day: day) }
                                }
                        }
                    }
                }
            }
            .scrollTargetLayout()
        }
        .scrollPosition(id: $position, anchor: .center)
    }
}

private struct MonthChip: View {
    let day: CalendarDay

    var body: some View {
        let month = day.date.formatted(.dateTime.month(.abbreviated))
        Text(day.year == CalendarDay.today.year ? month : "\(month) '\(day.date.formatted(.dateTime.year(.twoDigits)))")
            .font(AppFont.medium(11))
            .padding(.horizontal, 8)
            .background(Theme.surfaceRaised, in: Capsule())
            .offset(y: -7)
    }
}
