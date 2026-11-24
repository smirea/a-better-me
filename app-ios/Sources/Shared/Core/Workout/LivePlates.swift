import Foundation

/// An exercise's plate loading in the session's gym, for the surfaces off the phone's screen: the watch's set screen,
/// the Live Activity, and the rest notification. Each runs the phone calculator's `PlatePlan` on it, so all of them read
/// "45 10 5 + 13 bar" alike. It is the wire copy of `PlateLoading`, in the display unit, with only what the plan reads,
/// so `PlateLoading` can change without breaking a watch on an older build.
struct LivePlates: Codable, Hashable, Sendable {
    struct Plate: Codable, Hashable, Sendable {
        var weight: Double
        var perSide: Int?
        var isBumper: Bool?
    }

    var isBar: Bool
    var baseWeight: Double
    var plates: [Plate]
    var sides: Int
    /// What the calculator targets instead of the logged weight, where the gym turns Offset Weight on.
    var offset: PlateOffset?
    /// The bar or machine, set only when the session has a gym to keep the calculator's choice to count it in.
    var baseID: EquipmentID?
    /// The base's weight while the calculator leaves it out, as on `PlateLoading`.
    var ignoredBaseWeight: Double?
}

extension LivePlates {
    init(_ loading: PlateLoading, offset: PlateOffset?, togglesBase: Bool) {
        self.init(
            isBar: loading.base == .bar, baseWeight: loading.baseWeight,
            plates: loading.plates.map { Plate(weight: $0.weight, perSide: $0.perSide, isBumper: $0.isBumper ? true : nil) },
            sides: loading.sides, offset: offset, baseID: togglesBase ? loading.baseID : nil, ignoredBaseWeight: loading.ignoredBaseWeight
        )
    }

    var loading: PlateLoading {
        PlateLoading(
            base: isBar ? .bar : .machine, baseWeight: baseWeight,
            plates: plates.map { .init(weight: $0.weight, perSide: $0.perSide, isBumper: $0.isBumper ?? false) }, sides: sides,
            ignoredBaseWeight: ignoredBaseWeight
        )
    }

    var countsBase: Bool { ignoredBaseWeight == nil }

    /// Whether the bar button can flip the base: it has a weight, and a gym to keep the choice in.
    var togglesBase: Bool { baseID != nil && (ignoredBaseWeight ?? baseWeight) > 0 }

    /// The loading once the calculator counts the base, or leaves it out, as `Loading.resolve` builds it.
    func counting(base counts: Bool) -> LivePlates {
        guard counts != countsBase else { return self }
        var plates = self
        let own = ignoredBaseWeight ?? baseWeight
        plates.baseWeight = counts ? own : 0
        plates.ignoredBaseWeight = counts ? nil : own
        return plates
    }

    /// The phone calculator's plan for `weightKg`, or nil when there is nothing to load.
    func plan(weightKg: Double?, unit: WeightUnit) -> PlatePlan? {
        guard let weightKg, weightKg > 0 else { return nil }
        let typed = unit.fromKg(weightKg)
        let plan = loading.plan(for: offset?.applied(to: typed, unit: unit) ?? typed)
        return plan.loaded.isEmpty && plan.baseLabel == nil && plan.ignoredBaseLabel == nil ? nil : plan
    }
}
