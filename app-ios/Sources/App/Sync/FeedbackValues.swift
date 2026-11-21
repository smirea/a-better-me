import Feedback
import Foundation

/// Compact `FeedbackRepresentable` summaries for large internal caches and dictionary-heavy models.
/// Feedback's `Describer` maps every element of a collection or dictionary before truncating to 10, so reflecting
/// full memo caches, `FoodNutrition` dictionaries, or whole-table observations stalled the main thread on shake.
enum FeedbackSummary {
    private static let limit = 10

    static func capped(_ value: Any) -> Any {
        if value is any StringProtocol { return value }
        if let collection = value as? any Collection {
            return capCollection(collection)
        }
        return value
    }

    private static func capCollection<C: Collection>(_ collection: C) -> Any {
        let count = collection.count
        guard count > limit else { return collection }
        var head: [Any] = collection.prefix(limit).map { $0 }
        head.append("… \(count - limit) more")
        return head
    }
}

/// Memoization caches hold derived copies of data the view already exposes; omit them from feedback captures.
extension ViewMemo: FeedbackRepresentable {
    var feedbackValue: Any { { () -> Void in } }
}

extension FoodNutrition: FeedbackRepresentable {
    var feedbackValue: Any {
        (
            kcal: nutrients[.energy],
            protein: nutrients[.protein],
            fat: nutrients[.fat],
            carbs: nutrients[.carbs],
            nutrients: nutrients.count
        )
    }
}

extension NutritionData: FeedbackRepresentable {
    nonisolated var feedbackValue: Any {
        MainActor.assumeIsolated {
            (days: log.count, plans: plans.count, goals: goals.count, bodyMetrics: bodyMetrics.count)
        }
    }
}

extension FoodLogState: FeedbackRepresentable {
    nonisolated var feedbackValue: Any {
        MainActor.assumeIsolated {
            (day: day, entries: entries.count, selecting: selecting, selection: selection.count, pending: pending?.action.title)
        }
    }
}
