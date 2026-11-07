import Feedback
import SwiftUI

/// The day's calories and macros with a plate counted in, drawn as the Food Log's summary is. Swiping steps through
/// Nutrition Display, as swiping MacroFactor's banner does.
struct PlateDayTotals: View {
    let day: CalendarDay
    let plate: NutrientAmounts?
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings
    @Observe(NutritionPlan.all) private var plans
    @Observe(NutrientGoal.all) private var goals
    @Observe(BodyWeight.latest) private var latestWeight
    @Observe<[FoodEntry]> private var entries: [FoodEntry]
    @Observe<NutritionDay> private var dayRow: NutritionDay

    init(day: CalendarDay, plate: NutrientAmounts?) {
        self.day = day
        self.plate = plate
        _entries = Observe(FoodEntry.on(day))
        _dayRow = Observe(NutritionDay.one(day))
    }

    var body: some View {
        let display = settings.nutrition.logger.nutritionDisplay
        let lines = NutrientTargets.of(day, plans: plans, goals: goals, profile: settings.profile, latestWeightKg: latestWeight?.weightKg)
            .summary(dayRow.totals(entries), plate: plate, settings: settings)
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
