import Foundation

/// What one resistance option can load in a gym, in the display unit. Working in the display unit keeps sums of lb
/// plates exact for a lb owner (45 lb is 20.41165665 kg), and every comparison rounds to hundredths of that unit.
enum Loading: Hashable, Sendable {
    /// A loadable bar or a plate-loaded machine: a base weight plus plates on one or both sides.
    case plates(PlateLoading)
    /// Fixed loads in ascending order: dumbbells, kettlebells, fixed bars, or a pin stack's positions.
    case steps([Double])

    var plates: PlateLoading? { if case let .plates(plates) = self { plates } else { nil } }

    /// The − / + stepper: the next loadable total above or below `value`. A value between two loads moves to the
    /// neighbor in that direction, so the first press snaps an untidy weight. `nil` at either end.
    func step(from value: Double, up: Bool) -> Double? {
        switch self {
        case let .plates(plates): plates.step(from: value, up: up)
        case let .steps(steps): up ? steps.first { Hundredths(of: $0) > Hundredths(of: value) } : steps.last { Hundredths(of: $0) < Hundredths(of: value) }
        }
    }

    /// The first `limit` totals `step(from:up:)` walks through upward from zero, up to `ceiling`.
    func totals(upTo ceiling: Double, limit: Int) -> [Double] {
        switch self {
        case let .plates(plates): return plates.totals(upTo: ceiling, limit: limit)
        case let .steps(steps):
            var totals: [Double] = []
            for step in steps where totals.count < limit && step <= ceiling && Hundredths(of: step) > Hundredths(of: totals.last ?? 0) {
                totals.append(step)
            }
            return totals
        }
    }
}

struct PlateLoading: Hashable, Sendable {
    enum Base: Hashable, Sendable { case bar, machine }

    var base: Base
    var baseWeight: Double
    /// Plate weights, each with the number a side can take (`nil` for unlimited).
    var plates: [Plate]
    /// 2 for bars and machines loaded on both sides, 1 for single-sleeve machines.
    var sides: Int
    /// The bar or machine, with every weight it comes in (ascending) when the gym lists several, so the calculator can
    /// offer the choice `ExerciseOverrides.barWeightKg` stores.
    var baseID: EquipmentID?
    var baseWeights: [Double]

    struct Plate: Hashable, Sendable {
        var weight: Double
        var perSide: Int?
        var isBumper = false
    }

    init(base: Base, baseWeight: Double, plates: [Plate], sides: Int, baseID: EquipmentID? = nil, baseWeights: [Double] = []) {
        self.base = base
        self.baseWeight = baseWeight
        self.plates = plates.filter { $0.weight > 0 && $0.perSide != 0 }.sorted { $0.weight > $1.weight }
        self.sides = sides
        self.baseID = baseID
        self.baseWeights = baseWeights
    }

    /// MF's calculator (research milestone-2 §4.4): plates go on greedily from the heaviest down while the total stays
    /// at or under `target`, at most `sidePlates` a side. A miss shows what fits; a target below the base loads nothing.
    func plan(for target: Double) -> PlatePlan {
        PlatePlan(loading: self, target: target, loaded: greedyPlates(upTo: Hundredths(of: target).value))
    }

    /// The − / + stepper moves through totals the calculator loads exactly, so it never lands on a "missing" weight.
    func step(from value: Double, up: Bool) -> Double? {
        let current = Hundredths(of: value).value
        let window = max(0, (value - baseWeight) / Double(self.sides)) + (plates.first?.weight ?? 0)
        let sides = reachableSides(upTo: Hundredths(of: window).value + 1)
        let totals = sides.map { Hundredths(of: total($0)).value }.filter { total in
            Hundredths(of: self.total(greedy(upTo: total).reduce(0, +))).value == total
        }
        let next = up ? totals.first { $0 > current } : totals.last { $0 < current }
        return next.map { Double($0) / 100 }
    }

    /// One knapsack for the whole walk: stepping 400 times rebuilt it per step, which blocked launch for seconds while
    /// the watch's home list listed every workout's loadable weights.
    func totals(upTo ceiling: Double, limit: Int) -> [Double] {
        let ceiling = Hundredths(of: ceiling).value
        let window = max(0, (Double(ceiling) / 100 - baseWeight) / Double(sides)) + (plates.first?.weight ?? 0)
        let totals = reachableSides(upTo: Hundredths(of: window).value + 1).lazy
            .map { Hundredths(of: self.total($0)).value }
            .filter { total in
                total > 0 && total <= ceiling && Hundredths(of: self.total(greedy(upTo: total).reduce(0, +))).value == total
            }
            .prefix(limit)
        return totals.map { Double($0) / 100 }
    }

    /// MF loaded a 4,955 lb entry as 10 x 45 a side and nothing else, so a sleeve holds 10 plates.
    static let sidePlates = 10

    private func total(_ side: Double) -> Double { baseWeight + side * Double(sides) }

    private func greedy(upTo goal: Int) -> [Double] {
        greedyPlates(upTo: goal).map(\.weight)
    }

    private func greedyPlates(upTo goal: Int) -> [Plate] {
        var loaded: [Plate] = []
        var side = 0.0
        for plate in plates {
            var count = 0
            while count < plate.perSide ?? .max, loaded.count < Self.sidePlates,
                  Hundredths(of: total(side + plate.weight)).value <= goal {
                loaded.append(plate)
                side += plate.weight
                count += 1
            }
        }
        return loaded
    }

    /// Every one-side sum the plates can make up to `limit` hundredths, ascending, as a bounded knapsack: the stepper's
    /// candidates before the greedy check. Sums are kept exact and only indexed by hundredths, since rounding each
    /// converted plate first drifts. Plates mixing kg and lb can lose a candidate that shares a slot with another.
    private func reachableSides(upTo limit: Int) -> [Double] {
        let limit = min(limit, Hundredths(of: (plates.first?.weight ?? 0) * Double(Self.sidePlates)).value)
        guard limit >= 0 else { return [0] }
        var exact = [Double?](repeating: nil, count: limit + 1)
        exact[0] = 0
        var used = [Int](repeating: 0, count: limit + 1)
        for plate in plates {
            for index in used.indices { used[index] = 0 }
            let available = min(plate.perSide ?? .max, Self.sidePlates)
            for index in 0...limit {
                guard let sum = exact[index], used[index] < available else { continue }
                let next = Hundredths(of: sum + plate.weight).value
                guard next > index, next <= limit, exact[next] == nil else { continue }
                exact[next] = sum + plate.weight
                used[next] = used[index] + 1
            }
        }
        return exact.compactMap(\.self)
    }
}

/// The plates the calculator draws for one target, heaviest first, and the legend beside the drawing.
struct PlatePlan: Equatable, Sendable {
    var loading: PlateLoading
    var target: Double
    /// One side's plates, heaviest first.
    var loaded: [PlateLoading.Plate]

    var perSide: [Double] { loaded.map(\.weight) }

    var total: Double { loading.baseWeight + perSide.reduce(0, +) * Double(loading.sides) }

    /// "13 bar + 45 10 5": the bar (or a machine's base) when it weighs anything, then a side's plates in loading order,
    /// each written out rather than counted, so it reads like the sleeve. Empty for a weightless base with no plates.
    var legend: String {
        [baseLabel, plateLabels.isEmpty ? nil : plateLabels.joined(separator: " ")].compactMap(\.self).joined(separator: " + ")
    }

    var baseLabel: String? {
        loading.baseWeight > 0 ? "\(NumberText.plain(loading.baseWeight)) \(loading.base == .bar ? "bar" : "base")" : nil
    }

    var plateLabels: [String] { perSide.map(NumberText.plain) }

    /// "5 lb short" when the plates can't reach the target, "45 lb over" when the bar alone is past it, nil when they
    /// load it exactly.
    func miss(unit: String) -> String? {
        let difference = Hundredths(of: total).value - Hundredths(of: target).value
        guard difference != 0 else { return nil }
        return "\(NumberText.plain(Double(abs(difference)) / 100)) \(unit) \(difference < 0 ? "short" : "over")"
    }
}

/// A weight in hundredths of the display unit, the grain every loading rule compares in.
private struct Hundredths: Comparable {
    let value: Int

    init(of weight: Double) { value = Int((weight * 100).rounded()) }

    static func < (lhs: Self, rhs: Self) -> Bool { lhs.value < rhs.value }
}
