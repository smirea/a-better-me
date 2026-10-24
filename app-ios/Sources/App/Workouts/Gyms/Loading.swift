import Foundation

/// What one resistance option can load in a gym, in the display unit. Working in the display unit keeps sums of lb
/// plates exact for a lb owner (45 lb is 20.41165665 kg), and every comparison rounds to hundredths of that unit.
enum Loading: Equatable {
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
}

struct PlateLoading: Equatable {
    enum Base: Equatable { case bar, machine }

    var base: Base
    var baseWeight: Double
    /// Plate weights, each with the number a side can take (`nil` for unlimited).
    var plates: [Plate]
    /// 2 for bars and machines loaded on both sides, 1 for single-sleeve machines.
    var sides: Int

    struct Plate: Equatable {
        var weight: Double
        var perSide: Int?
    }

    init(base: Base, baseWeight: Double, plates: [Plate], sides: Int) {
        self.base = base
        self.baseWeight = baseWeight
        self.plates = plates.filter { $0.weight > 0 && $0.perSide != 0 }.sorted { $0.weight > $1.weight }
        self.sides = sides
    }

    /// MF's calculator: the lightest load that reaches `target`, with the heaviest plates first. A target below the
    /// base loads nothing and reports the base as extra; a target past the heaviest load shows the heaviest load.
    func plan(for target: Double) -> PlatePlan {
        let beyondBase = max(0, Hundredths(of: target).value - Hundredths(of: baseWeight).value)
        let need = (beyondBase + sides - 1) / sides
        let reachable = reachableSides(upTo: need + (plates.map { Hundredths(of: $0.weight).value }.max() ?? 0))
        let side = reachable.indices.first { $0 >= need && reachable[$0] } ?? reachable.lastIndex(of: true) ?? 0
        return PlatePlan(loading: self, target: target, perSide: decompose(side) ?? [])
    }

    func step(from value: Double, up: Bool) -> Double? {
        let current = Hundredths(of: value)
        let maxPlate = plates.map { Hundredths(of: $0.weight).value }.max() ?? 0
        let reachable = reachableSides(upTo: max(0, (current.value - Hundredths(of: baseWeight).value) / sides) + maxPlate)
        let totals = reachable.indices.filter { reachable[$0] }.map { Hundredths(of: baseWeight).value + $0 * sides }
        let next = up ? totals.first { $0 > current.value } : totals.last { $0 < current.value }
        return next.map { Double($0) / 100 }
    }

    /// Which one-side sums, in hundredths, the plates can make, as a bounded knapsack up to `limit`.
    private func reachableSides(upTo limit: Int) -> [Bool] {
        var reachable = [Bool](repeating: false, count: limit + 1)
        reachable[0] = true
        for plate in plates {
            let weight = Hundredths(of: plate.weight).value
            guard weight <= limit else { continue }
            let available = plate.perSide ?? limit / weight
            var used = [Int](repeating: 0, count: limit + 1)
            for sum in weight...limit where !reachable[sum] && reachable[sum - weight] && used[sum - weight] < available {
                reachable[sum] = true
                used[sum] = used[sum - weight] + 1
            }
        }
        return reachable
    }

    /// The plates for one side summing to `side` hundredths, trying the most of each heavier plate first, the way a
    /// lifter loads a bar. `nil` when no combination makes it.
    private func decompose(_ side: Int) -> [Double]? {
        let weights = plates.map { Hundredths(of: $0.weight).value }
        var failed = Set<[Int]>()
        func search(_ index: Int, _ remaining: Int) -> [Int]? {
            if remaining == 0 { return [] }
            guard index < plates.count, !failed.contains([index, remaining]) else { return nil }
            let most = min(remaining / weights[index], plates[index].perSide ?? .max)
            for count in stride(from: most, through: 0, by: -1) {
                if let rest = search(index + 1, remaining - count * weights[index]) {
                    return Array(repeating: index, count: count) + rest
                }
            }
            failed.insert([index, remaining])
            return nil
        }
        return search(0, side).map { $0.map { plates[$0].weight } }
    }
}

/// The plates the calculator draws for one target, heaviest first, and the sentence under the drawing.
struct PlatePlan: Equatable {
    var loading: PlateLoading
    var target: Double
    var perSide: [Double]

    var total: Double { loading.baseWeight + perSide.reduce(0, +) * Double(loading.sides) }

    /// "1 x 45", "2 x 25": one line per plate weight on a side, heaviest first.
    var legend: [(count: Int, weight: Double)] {
        var lines: [(count: Int, weight: Double)] = []
        for weight in perSide {
            if let last = lines.last, last.weight == weight { lines[lines.count - 1].count += 1 } else { lines.append((1, weight)) }
        }
        return lines
    }

    /// "70 lb on both sides + 45 lb bar weight = 185 lb", or for a load that misses the target, "0 lb on both sides +
    /// 45 lb bar weight = 0 lb + extra 45 lb". Below the heaviest load the miss is always extra, since the plan rounds
    /// up; past it the sentence says what is missing.
    func sentence(unit: String) -> String {
        func label(_ value: Double) -> String { "\(SetField.plain(value)) \(unit)" }
        let sides = loading.sides == 2 ? "on both sides" : "on one side"
        let base = loading.base == .bar ? "bar weight" : "base weight"
        let start = "\(label(perSide.reduce(0, +))) \(sides) + \(label(loading.baseWeight)) \(base) = \(label(target))"
        let difference = Hundredths(of: total).value - Hundredths(of: target).value
        if difference > 0 { return "\(start) + extra \(label(Double(difference) / 100))" }
        if difference < 0 { return "\(start) - missing \(label(Double(-difference) / 100))" }
        return start
    }
}

/// A weight in hundredths of the display unit, the grain every loading rule compares in.
private struct Hundredths: Comparable {
    let value: Int

    init(of weight: Double) { value = Int((weight * 100).rounded()) }

    static func < (lhs: Self, rhs: Self) -> Bool { lhs.value < rhs.value }
}
