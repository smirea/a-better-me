import Feedback
import SwiftUI

/// The header row's days: as many pills as fit at a comfortable width, an odd count so the selected day sits in the
/// middle with as many days on each side. It scrolls freely a pill at a time, and a new selection scrolls it back to
/// the middle.
struct DayStrip: View {
    let selected: CalendarDay
    let plans: [NutritionPlan]

    @Environment(FoodLogState.self) private var state
    @ScaledMetric private var minPillWidth: CGFloat = 42
    @State private var origin = CalendarDay.today
    @State private var position = ScrollPosition(idType: Int.self)
    @State private var width: CGFloat = 0

    private static let spacing: CGFloat = 6

    init(selected: CalendarDay, plans: [NutritionPlan]) {
        self.selected = selected
        self.plans = plans
    }

    var body: some View {
        let count = FoodLog.stripCount(width: width, minPill: minPillWidth, spacing: Self.spacing)
        let pillWidth = max(0, (width - CGFloat(count - 1) * Self.spacing) / CGFloat(count))
        ScrollView(.horizontal) {
            LazyHStack(spacing: Self.spacing) {
                ForEach(-FoodLogState.daysBack...FoodLogState.daysAhead, id: \.self) { offset in
                    let day = origin.adding(days: offset)
                    StripPill(day: day, plans: plans, isSelected: day == selected) { state.day = day }
                        .frame(width: pillWidth)
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
        .feedback(self)
    }
}

/// A day's pill, its outline filling with the day's calories against its target. Each observes only its own day, and
/// the strip is lazy, so only the pills on screen query.
private struct StripPill: View {
    let day: CalendarDay
    let plans: [NutritionPlan]
    let isSelected: Bool
    let action: () -> Void

    @Observe private var entries: [FoodEntry]
    @Observe private var row: NutritionDay

    init(day: CalendarDay, plans: [NutritionPlan], isSelected: Bool, action: @escaping () -> Void) {
        self.day = day
        self.plans = plans
        self.isSelected = isSelected
        self.action = action
        _entries = Observe(FoodEntry.on(day))
        _row = Observe(NutritionDay.one(day))
    }

    var body: some View {
        let kcal = row.totals(entries)[.energy] ?? 0
        let target = NutritionPlan.effective(on: day, in: plans)?.target(on: day).energy
        DayPill(
            day: day, isSelected: isSelected,
            ring: DayRing(fraction: FoodLog.ringProgress(kcal: kcal, target: target), color: Theme.calories),
            action: action
        )
    }
}
