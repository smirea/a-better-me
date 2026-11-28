import Feedback
import SwiftUI

/// The day's calories and macros with a plate counted in, drawn as the Food Log's summary is. Swiping steps through
/// Nutrition Display, as swiping MacroFactor's banner does. `replacing` leaves out the entry the plate stands for, as
/// Alter's plate is the altered recipe. `plateOnly` shows the plate alone and does not swipe, for a plate that is never
/// logged (a recipe's ingredients).
struct PlateDayTotals: View {
    let day: CalendarDay
    let plate: NutrientAmounts?
    var replacing: UUID?
    var plateOnly = false
    @Environment(LocalStore.self) private var store
    private var targets = OwnerTargets()
    @Observe<[FoodEntry]> private var entries: [FoodEntry]
    @Observe<NutritionDay> private var dayRow: NutritionDay

    init(day: CalendarDay, plate: NutrientAmounts?, replacing: UUID? = nil, plateOnly: Bool = false) {
        self.day = day
        self.plate = plate
        self.replacing = replacing
        self.plateOnly = plateOnly
        _entries = Observe(FoodEntry.on(day))
        _dayRow = Observe(NutritionDay.one(day))
    }

    var body: some View {
        if plateOnly {
            let lines = targets.on(day).summary([:], plate: plate ?? [:], settings: targets.settings)
            MacroTotalsBars(lines: lines, page: .plate)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(lines.map(\.spoken).joined(separator: ", "))
                .feedback(self)
        } else {
            dayTotals
        }
    }

    private var dayTotals: some View {
        let display = targets.settings.nutrition.logger.nutritionDisplay
        let counted = NutritionDay.counted(dayRow, entries.filter { $0.id != replacing }, plate: plate)
        let lines = targets.on(day).summary(counted.logged, plate: counted.plate, settings: targets.settings)
        return MacroTotalsBars(lines: lines, page: display.page)
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
