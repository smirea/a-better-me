import Foundation

/// The New Goal form for one nutrient: a start day, Auto, Custom, or None, and under Custom a target, floor, and
/// ceiling that are each None (nil) or a number.
struct NutrientGoalDraft: Hashable {
    enum Kind: Hashable, CaseIterable {
        case auto, custom, none

        var title: String {
            switch self {
            case .auto: "Auto"
            case .custom: "Custom"
            case .none: "None"
            }
        }

        var subtitle: String {
            switch self {
            case .auto: "We will set and continuously update the floor, target, and ceiling for you"
            case .custom: "Set your own goal parameters"
            case .none: "Nutrient will not display targets or ranges"
            }
        }
    }

    var startsOn: CalendarDay
    var kind = Kind.auto
    var range = NutrientRange()

    init(startsOn: CalendarDay) {
        self.startsOn = startsOn
    }

    /// Editing a saved goal starts from its values.
    init(_ goal: NutrientGoal) {
        startsOn = goal.startsOn
        switch goal.mode {
        case .auto: kind = .auto
        case let .custom(range):
            kind = .custom
            self.range = range
        case .hidden: kind = .none
        }
    }

    var mode: NutrientGoal.Mode {
        switch kind {
        case .auto: .auto
        case .custom: .custom(range)
        case .none: .hidden
        }
    }

    /// Why Save is off, or nil. Bounds that are set must not cross: floor ≤ target ≤ ceiling.
    var problem: String? {
        guard kind == .custom else { return nil }
        let bounds = [range.floor, range.target, range.ceiling]
        if bounds.allSatisfy({ $0 == nil }) { return "Set at least one of the target, floor, or ceiling." }
        if bounds.contains(where: { ($0 ?? 0) < 0 }) { return "Amounts can't be negative." }
        let set = bounds.compactMap(\.self)
        return set == set.sorted() ? nil : "The floor must not exceed the target, and the target must not exceed the ceiling."
    }

    /// "Default · Auto", "Custom", or "None" for a goal, or the default when there is none.
    static func label(_ goal: NutrientGoal?) -> String {
        switch goal?.mode {
        case nil: "Default · Auto"
        case .auto: "Auto"
        case .custom: "Custom"
        case .hidden: "None"
        }
    }
}
