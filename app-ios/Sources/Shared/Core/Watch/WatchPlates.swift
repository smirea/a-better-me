import Foundation

/// An exercise's plate loading in the session's gym, as the watch's set screen draws it under the weight: "45 10 5 +
/// 13 bar". It is the wire copy of `PlateLoading`, in the display unit, with only what the calculator's plan reads, so
/// `PlateLoading` can change without breaking a watch on an older build.
struct WatchPlates: Codable, Hashable, Sendable {
    struct Plate: Codable, Hashable, Sendable {
        var weight: Double
        var perSide: Int?
    }

    var isBar: Bool
    var baseWeight: Double
    var plates: [Plate]
    var sides: Int
    /// What the calculator targets instead of the logged weight, where the gym turns Offset Weight on.
    var offset: PlateOffset?
}

extension WatchPlates {
    init(_ loading: PlateLoading, offset: PlateOffset?) {
        self.init(
            isBar: loading.base == .bar, baseWeight: loading.baseWeight,
            plates: loading.plates.map { Plate(weight: $0.weight, perSide: $0.perSide) }, sides: loading.sides, offset: offset
        )
    }

    var loading: PlateLoading {
        PlateLoading(base: isBar ? .bar : .machine, baseWeight: baseWeight, plates: plates.map { .init(weight: $0.weight, perSide: $0.perSide) }, sides: sides)
    }

    /// The phone calculator's plan for `weightKg`, or nil when there is nothing to load.
    func plan(weightKg: Double?, unit: WeightUnit) -> PlatePlan? {
        guard let weightKg, weightKg > 0 else { return nil }
        let typed = unit.fromKg(weightKg)
        let plan = loading.plan(for: offset?.applied(to: typed, unit: unit) ?? typed)
        return plan.legend.isEmpty ? nil : plan
    }
}
