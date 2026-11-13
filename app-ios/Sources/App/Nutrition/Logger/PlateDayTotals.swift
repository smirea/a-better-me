import Feedback
import SwiftUI

/// The day's calories and macros with a plate counted in, drawn as the Food Log's summary is. Swiping steps through
/// Nutrition Display, as swiping MacroFactor's banner does. `replacing` leaves out the entry the plate stands for, as
/// Alter's plate is the altered recipe.
struct PlateDayTotals: View {
    let day: CalendarDay
    let plate: NutrientAmounts?
    var replacing: UUID?
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings
    @Observe(NutritionPlan.all) private var plans
    @Observe(NutrientGoal.all) private var goals
    @Observe(BodyWeight.latest) private var latestWeight
    @Observe<[FoodEntry]> private var entries: [FoodEntry]
    @Observe<NutritionDay> private var dayRow: NutritionDay

    init(day: CalendarDay, plate: NutrientAmounts?, replacing: UUID? = nil) {
        self.day = day
        self.plate = plate
        self.replacing = replacing
        _entries = Observe(FoodEntry.on(day))
        _dayRow = Observe(NutritionDay.one(day))
    }

    var body: some View {
        let display = settings.nutrition.logger.nutritionDisplay
        let counted = Self.counted(dayRow, entries.filter { $0.id != replacing }, plate: plate)
        let lines = NutrientTargets.of(day, plans: plans, goals: goals, profile: settings.profile, latestWeightKg: latestWeight?.weightKg)
            .summary(counted.logged, plate: counted.plate, settings: settings)
        MacroTotalsBars(lines: lines, page: display.page)
            .gesture(DragGesture(minimumDistance: 20).onEnded { drag in
                guard abs(drag.translation.width) > 30, abs(drag.translation.width) > abs(drag.translation.height) else { return }
                store.updateSettings { $0.nutrition.logger.nutritionDisplay = display.cycled(by: drag.translation.width < 0 ? 1 : -1) }
            })
            .sensoryFeedback(.selection, trigger: display)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(lines.map(\.spoken).joined(separator: ", "))
            .accessibilityAdjustableAction { direction in
                store.updateSettings { $0.nutrition.logger.nutritionDisplay = display.cycled(by: direction == .increment ? 1 : -1) }
            }
            .feedback(self)
    }
}

extension PlateDayTotals {
    /// The day's totals without the plate, and the plate, as the bars draw them. An edited day's totals win over what is
    /// logged, so a plate changes none of the nutrients they cover: there the plate is drawn as part of the edited
    /// total, at most all of it, instead of on top of it.
    static func counted(_ day: NutritionDay, _ entries: [FoodEntry], plate: NutrientAmounts?) -> (logged: NutrientAmounts, plate: NutrientAmounts?) {
        var totals = day.totals(entries)
        var plate = plate
        for (id, value) in day.override ?? [:] {
            let share = min(plate?[id] ?? 0, value)
            if plate != nil { plate?[id] = share }
            totals[id] = value - share
        }
        return (totals, plate)
    }
}
