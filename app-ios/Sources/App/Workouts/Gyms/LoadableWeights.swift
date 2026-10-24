import Foundation

/// The weights Smart Progression and the warm-up calculators may suggest for one exercise in the session's gym, in the
/// display unit: the totals its loading puts together, or multiples of the unit increment for equipment without a load
/// (bands, bodyweight). It answers through `Loading`'s calculator and stepper, so a suggestion is a weight the plate
/// panel loads exactly and − / + lands on.
struct LoadableWeights: Equatable {
    private var loading: Loading?
    private let unit: WeightUnit
    /// Simplify Warm-Up Plates on fixed loads and the increment: round to this before snapping.
    private var grain: Double?

    /// A loading with no positive total (a bare 0 lb base, a 0-only rack) falls back to the increment.
    init(loading: Loading?, unit: WeightUnit) {
        self.unit = unit
        self.loading = loading?.step(from: 0, up: true) == nil ? nil : loading
    }

    var increment: Double { WarmUpScheme.increment(for: unit) }

    var lightest: Double { loading?.step(from: 0, up: true) ?? increment }

    /// The heaviest loadable weight at or below `weight`, or `nil` when even the lightest is heavier.
    func floor(_ weight: Double) -> Double? {
        guard let loading else {
            let floored = (weight / increment + 1e-9).rounded(.down) * increment
            return floored > 0 ? floored : nil
        }
        if let exact = exactly(weight, in: loading) { return exact }
        return loading.step(from: weight, up: false).flatMap { $0 > 0 ? $0 : nil }
    }

    /// The loadable weight closest to `weight`, the heavier one on a tie, and never below the lightest.
    func nearest(_ weight: Double) -> Double {
        let target = grain.map { (weight / $0).rounded() * $0 } ?? weight
        guard let loading else { return max(increment, (target / increment).rounded() * increment) }
        let below = floor(target)
        let above = exactly(target, in: loading) ?? loading.step(from: target, up: true)
        switch (below, above) {
        case let (below?, above?): return target - below < above - target ? below : above
        case let (below?, nil): return below
        case let (nil, above?): return above
        case (nil, nil): return lightest
        }
    }

    /// Simplify Warm-Up Plates: "the nearest load that doesn't require trivially small plates". Plates below 10 lb /
    /// 5 kg come off the bar; fixed loads and the increment round to that grain first, then snap.
    var simplified: LoadableWeights {
        let coarse = unit == .kg ? 5.0 : 10.0
        var copy = self
        if case let .plates(plates)? = loading {
            let heavy = plates.plates.filter { $0.weight >= coarse - 0.005 }
            copy.loading = .plates(PlateLoading(base: plates.base, baseWeight: plates.baseWeight, plates: heavy, sides: plates.sides))
        } else {
            copy.grain = coarse
        }
        return copy
    }

    private func exactly(_ weight: Double, in loading: Loading) -> Double? {
        switch loading {
        case let .plates(plates):
            let total = plates.plan(for: weight).total
            return total > 0 && abs(total - weight) < 0.005 ? total : nil
        case let .steps(steps):
            return steps.first { $0 > 0 && abs($0 - weight) < 0.005 }
        }
    }
}
