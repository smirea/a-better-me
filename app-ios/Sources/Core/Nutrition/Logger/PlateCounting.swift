import Foundation

extension NutritionDay {
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
