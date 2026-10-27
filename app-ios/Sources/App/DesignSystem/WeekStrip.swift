import SwiftUI

/// How full a day pill's outline is drawn, and in which color: the day's calories against target, a logged workout,
/// or the active program's cycle.
struct DayRing: Equatable {
    var fraction: Double
    var color: Color
}

/// The app's one day pill: the day number over its weekday, a dot on today, and an outline that fills with `ring`.
struct DayPill: View {
    let day: CalendarDay
    var isSelected = false
    var ring: DayRing?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 1) {
                Text("\(day.day)").font(AppFont.headline(16)).monospacedDigit()
                Text(day.date.formatted(.dateTime.weekday(.short)).prefix(2))
                    .font(AppFont.caption(11))
                    .foregroundStyle(Theme.textSecondary)
                Circle().fill(day == .today ? Theme.textPrimary : .clear).frame(width: 4, height: 4)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background(isSelected ? Theme.textPrimary.opacity(0.18) : .clear, in: Capsule())
            .overlay {
                Capsule().strokeBorder(Theme.textTertiary.opacity(0.6), lineWidth: 1)
                if let ring, ring.fraction > 0 {
                    Capsule().inset(by: 0.75).trim(from: 0, to: min(1, ring.fraction))
                        .stroke(ring.color, style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
                        .rotationEffect(.degrees(180))
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(day.date.formatted(date: .complete, time: .omitted))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// Seven day pills a week per page, Monday first, used by the Food Log and the Workout tab. Swiping shows other weeks;
/// away from `anchor`'s week a round chevron returns to it, and a new `anchor` scrolls its week in.
struct WeekStrip<Week: View>: View {
    let anchor: CalendarDay
    /// Weeks before and after the current one that the strip reaches.
    let weeks: ClosedRange<Int>
    /// The pills of the week that starts on the given Monday.
    let week: (CalendarDay) -> Week

    @State private var origin: CalendarDay
    @State private var visible: Int?

    init(anchor: CalendarDay, weeks: ClosedRange<Int>, @ViewBuilder week: @escaping (CalendarDay) -> Week) {
        self.anchor = anchor
        self.weeks = weeks
        self.week = week
        let origin = CalendarDay.today.monday
        _origin = State(initialValue: origin)
        _visible = State(initialValue: origin.days(to: anchor.monday) / 7)
    }

    var body: some View {
        let anchorWeek = offset(of: anchor)
        ScrollView(.horizontal) {
            LazyHStack(spacing: 0) {
                ForEach(weeks, id: \.self) { offset in
                    HStack(spacing: 6) { week(origin.adding(days: offset * 7)) }
                        .padding(.horizontal, 20)
                        .containerRelativeFrame(.horizontal)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollPosition(id: $visible)
        .scrollIndicators(.hidden)
        .frame(height: 64)
        .onChange(of: anchorWeek) { _, week in
            withAnimation { visible = week }
        }
        .overlay(alignment: .trailing) {
            if let visible, visible != anchorWeek {
                Button("Back to Week", systemImage: visible < anchorWeek ? "chevron.right" : "chevron.left") {
                    withAnimation { self.visible = anchorWeek }
                }
                .labelStyle(.iconOnly)
                .buttonStyle(.glass)
                .buttonBorderShape(.circle)
                .padding(.trailing, 8)
            }
        }
    }

    private func offset(of day: CalendarDay) -> Int {
        origin.days(to: day.monday) / 7
    }
}
