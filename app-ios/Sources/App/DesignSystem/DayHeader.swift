import Feedback
import SwiftUI

/// Where the Calendar / Go to Today button sits in `DayHeaderRow`: leading on tab roots beside a trailing ⋯ menu, or
/// trailing on pushed screens so the Back button stays on the left.
enum DayHeaderCalendarPlacement {
    case leading
    case trailing
}

/// The header row of a screen that shows one day at a time: Calendar (Go to Today on any other day), the day strip, and
/// the screen's accessory button (a trailing ⋯ menu on tab roots, or a leading Back button on pushed screens), each in
/// a matching glass circle.
struct DayHeaderRow<Strip: View, Accessory: View>: View {
    @Binding var day: CalendarDay
    let calendarPlacement: DayHeaderCalendarPlacement
    @ViewBuilder let strip: Strip
    @ViewBuilder let accessory: Accessory

    @State private var showingCalendar = false

    init(
        day: Binding<CalendarDay>,
        @ViewBuilder strip: () -> Strip,
        @ViewBuilder menu: () -> Accessory
    ) {
        _day = day
        self.calendarPlacement = .leading
        self.strip = strip()
        self.accessory = menu()
    }

    init(
        day: Binding<CalendarDay>,
        @ViewBuilder leading: () -> Accessory,
        @ViewBuilder strip: () -> Strip
    ) {
        _day = day
        self.calendarPlacement = .trailing
        self.accessory = leading()
        self.strip = strip()
    }

    var body: some View {
        HStack(spacing: 8) {
            if calendarPlacement == .leading {
                calendarButton
                strip
                accessory.headerButton()
            } else {
                accessory.headerButton()
                strip
                calendarButton
            }
        }
        .padding(.horizontal, Theme.margin)
        .sheet(isPresented: $showingCalendar) { DayCalendarSheet(day: $day) }
    }

    private var calendarButton: some View {
        let onToday = day == .today
        return Button(onToday ? "Calendar" : "Go to Today", systemImage: onToday ? "calendar" : "arrow.uturn.backward") {
            if onToday { showingCalendar = true } else { day = .today }
        }
        .contentTransition(.symbolEffect(.replace))
        .animation(.snappy, value: onToday)
        .accessibilityHint(onToday ? "Opens the calendar" : "")
        .headerButton()
    }
}

private extension View {
    /// A fixed 48 pt glass circle, so the Calendar button and the ⋯ menu match.
    func headerButton() -> some View {
        labelStyle(.iconOnly)
            .foregroundStyle(Theme.textPrimary)
            .frame(width: 48, height: 48)
            .contentShape(.circle)
            .glassEffect(.regular.interactive(), in: .circle)
            .buttonStyle(.plain)
    }
}

/// The header row's days: as many pills as fit at a comfortable width, an odd count so the selected day sits in the
/// middle with as many days on each side. It scrolls freely a pill at a time, and a new selection scrolls it back to
/// the middle. `pill` draws a day's `DayPill` with the screen's own ring.
struct DayStrip<Pill: View>: View {
    let selected: CalendarDay
    @ViewBuilder let pill: (CalendarDay) -> Pill

    @ScaledMetric private var minPillWidth: CGFloat = 42
    @State private var origin = CalendarDay.today
    @State private var position = ScrollPosition(idType: Int.self)
    @State private var width: CGFloat = 0

    private static var spacing: CGFloat { 6 }

    var body: some View {
        let count = FoodLog.stripCount(width: width, minPill: minPillWidth, spacing: Self.spacing)
        let pillWidth = max(0, (width - CGFloat(count - 1) * Self.spacing) / CGFloat(count))
        ScrollView(.horizontal) {
            LazyHStack(spacing: Self.spacing) {
                ForEach(DayPaging.offsets, id: \.self) { offset in
                    pill(origin.adding(days: offset)).frame(width: pillWidth)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.viewAligned)
        .scrollPosition($position, anchor: .center)
        .scrollIndicators(.hidden)
        .frame(height: 56)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .onChange(of: selected) { _, day in
            withAnimation(.snappy) { position.scrollTo(id: origin.days(to: day), anchor: .center) }
        }
        // The first layout has no width yet, so the strip centers once it knows how wide its pills are.
        .onChange(of: pillWidth, initial: true) { position.scrollTo(id: origin.days(to: selected), anchor: .center) }
        .feedback("DayStrip")
    }
}

/// The days as horizontal pages: swiping moves a day, as MacroFactor's timeline does. `held` keeps the page, as the
/// Food Log's select mode does.
struct DayPager<Page: View>: View {
    @Binding var day: CalendarDay
    var held = false
    @ViewBuilder let page: (CalendarDay) -> Page

    @State private var origin = CalendarDay.today
    @State private var position: Int?

    var body: some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: 0) {
                ForEach(DayPaging.offsets, id: \.self) { offset in
                    page(origin.adding(days: offset)).containerRelativeFrame(.horizontal)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollPosition(id: $position)
        .scrollIndicators(.hidden)
        .scrollDisabled(held)
        .onAppear { position = origin.days(to: day) }
        .onChange(of: position) { _, position in
            guard let position else { return }
            let shown = origin.adding(days: position)
            if shown != day { day = shown }
        }
        .onChange(of: day) { _, day in
            let target = origin.days(to: day)
            guard position != target else { return }
            if let position, abs(position - target) == 1 {
                withAnimation { self.position = target }
            } else {
                position = target
            }
        }
    }
}

/// Select Date: the native month calendar, and Go to Today.
private struct DayCalendarSheet: View {
    @Binding var day: CalendarDay
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            DatePicker(
                "Day",
                selection: Binding(get: { day.date }, set: { day = CalendarDay($0); dismiss() }),
                in: CalendarDay.today.adding(days: DayPaging.offsets.lowerBound).date...CalendarDay.today.adding(days: DayPaging.offsets.upperBound).date,
                displayedComponents: .date
            )
            .datePickerStyle(.graphical)
            .padding(.horizontal, Theme.margin)
            .detailTitle("Select Date")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
                ToolbarItem(placement: .bottomBar) {
                    Button("Go to Today") {
                        day = .today
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .feedback("CalendarSheet")
    }
}
