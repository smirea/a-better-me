import Foundation
import GRDB

extension NutritionSnapshot {
    /// What the nutrition widgets show, from the database: today and the days after it.
    static func fetch(_ db: Database, today: CalendarDay) throws -> NutritionSnapshot {
        let last = today.adding(days: NutritionSnapshot.horizon - 1)
        let settings = try AppSettings.current.fetch(db)
        let plans = try NutritionPlan.all.fetch(db)
        let goals = try NutrientGoal.all.fetch(db)
        let latestWeightKg = try BodyWeight.latest.fetch(db)?.weightKg
        let entries = Dictionary(grouping: try FoodEntry.between(today, last).fetch(db), by: \.day)
        let rows = Dictionary(uniqueKeysWithValues: try NutritionDay.between(today, last).fetch(db).map { ($0.id, $0) })

        let nutrients = NutrientRegistry.all.filter { settings.nutrition.shows($0.id) }
        let days = (0..<NutritionSnapshot.horizon).map { offset in
            let day = today.adding(days: offset)
            let totals = (rows[day] ?? NutritionDay(id: day)).totals(entries[day] ?? [])
            let targets = NutrientTargets.of(day, plans: plans, goals: goals, profile: settings.profile, latestWeightKg: latestWeightKg)
            var consumed: [String: Double] = [:]
            var ranges: [String: NutritionSnapshot.Range] = [:]
            for nutrient in nutrients {
                consumed[nutrient.id.rawValue] = totals.amount(of: nutrient.id)
                let range = targets.range(nutrient.id)
                if range != NutrientRange() {
                    ranges[nutrient.id.rawValue] = NutritionSnapshot.Range(floor: range.floor, target: range.target, ceiling: range.ceiling)
                }
            }
            return NutritionSnapshot.Day(day: day.description, consumed: consumed, ranges: ranges)
        }
        return NutritionSnapshot(
            nutrients: nutrients.map { NutritionSnapshot.Nutrient(id: $0.id.rawValue, name: $0.name, short: $0.short, unit: $0.unit.label, tint: $0.tint) },
            pinned: settings.nutrition.summaryNutrients.filter(settings.nutrition.shows).map(\.rawValue),
            showOverages: settings.nutrition.showOverages,
            days: days
        )
    }
}
