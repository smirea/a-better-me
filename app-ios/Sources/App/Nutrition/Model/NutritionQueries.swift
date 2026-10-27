import Foundation
import GRDB

extension FoodEntry {
    /// The day's entries by time, then in the order they were logged.
    static func on(_ day: CalendarDay) -> DatabaseQuery<[FoodEntry]> {
        DatabaseQuery([]) { db in
            try FoodEntry.filter(Column("day") == day.description).fetchAll(db).sorted { ($0.minute, $0.createdAt) < ($1.minute, $1.createdAt) }
        }
    }

    /// Entries from `start` through `end`, oldest day first.
    static func between(_ start: CalendarDay, _ end: CalendarDay) -> DatabaseQuery<[FoodEntry]> {
        DatabaseQuery([]) { db in
            try FoodEntry.filter(Column("day") >= start.description && Column("day") <= end.description).fetchAll(db)
                .sorted { ($0.day, $0.minute, $0.createdAt) < ($1.day, $1.minute, $1.createdAt) }
        }
    }
}

extension FoodLogNote {
    static func on(_ day: CalendarDay) -> DatabaseQuery<[FoodLogNote]> {
        DatabaseQuery([]) { db in
            try FoodLogNote.filter(Column("day") == day.description).fetchAll(db).sorted { $0.minute < $1.minute }
        }
    }
}

extension NutritionDay {
    /// The rows from `start` through `end`; days without one are plain.
    static func between(_ start: CalendarDay, _ end: CalendarDay) -> DatabaseQuery<[NutritionDay]> {
        DatabaseQuery([]) { db in
            try NutritionDay.filter(Column("id") >= start.description && Column("id") <= end.description).fetchAll(db)
        }
    }

    static func one(_ day: CalendarDay) -> DatabaseQuery<NutritionDay> {
        DatabaseQuery(NutritionDay(id: day)) { try NutritionDay.fetchOne($0, key: key(day)) ?? NutritionDay(id: day) }
    }
}

extension Food {
    static let library = DatabaseQuery([Food]()) { db in
        try Food.filter(Column("archived") == false).fetchAll(db)
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }
}

extension Recipe {
    static let library = DatabaseQuery([Recipe]()) { db in
        try Recipe.filter(Column("archived") == false).fetchAll(db)
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }
}

extension FoodFavorite {
    static let all = DatabaseQuery([FoodFavorite]()) { db in
        try FoodFavorite.fetchAll(db).sorted { $0.createdAt < $1.createdAt }
    }
}

extension BodyMetric {
    /// Every manual metric of every kind, oldest first.
    static let all = DatabaseQuery([BodyMetric]()) { db in
        try BodyMetric.fetchAll(db).sorted { ($0.day, $0.kind.rawValue) < ($1.day, $1.kind.rawValue) }
    }

    /// Every value of `kind`, oldest first.
    static func series(_ kind: BodyMetricKind) -> DatabaseQuery<[BodyMetric]> {
        DatabaseQuery([]) { db in
            try BodyMetric.filter(Column("kind") == kind.rawValue).fetchAll(db).sorted { $0.day < $1.day }
        }
    }
}

extension NutritionPlan {
    /// Oldest first; `effective(on:in:)` picks a day's plan.
    static let all = DatabaseQuery([NutritionPlan]()) { db in
        try NutritionPlan.fetchAll(db).sorted { $0.id < $1.id }
    }
}

extension NutrientGoal {
    static let all = DatabaseQuery([NutrientGoal]()) { db in
        try NutrientGoal.fetchAll(db).sorted { ($0.startsOn, $0.nutrient.rawValue) < ($1.startsOn, $1.nutrient.rawValue) }
    }
}
