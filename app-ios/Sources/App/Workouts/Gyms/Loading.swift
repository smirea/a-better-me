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

    /// MF's calculator (research milestone-2 §4.4): plates go on greedily from the heaviest down while the total stays
    /// at or under `target`, at most `sidePlates` a side. A miss shows what fits; a target below the base loads nothing.
    func plan(for target: Double) -> PlatePlan {
        PlatePlan(loading: self, target: target, perSide: greedy(upTo: Hundredths(of: target).value))
    }

    /// The − / + stepper moves through totals the calculator loads exactly, so it never lands on a "missing" weight.
    func step(from value: Double, up: Bool) -> Double? {
        let current = Hundredths(of: value).value
        let sides = reachableSides(upTo: max(0, (current - Hundredths(of: baseWeight).value) / self.sides) + heaviestPlate)
        let totals = sides.map { Hundredths(of: total($0)).value }.filter { total in
            Hundredths(of: self.total(greedy(upTo: total).reduce(0, +))).value == total
        }
        let next = up ? totals.first { $0 > current } : totals.last { $0 < current }
        return next.map { Double($0) / 100 }
    }

    /// MF loaded a 4,955 lb entry as 10 x 45 a side and nothing else, so a sleeve holds 10 plates.
    static let sidePlates = 10

    private var heaviestPlate: Int { plates.map { Hundredths(of: $0.weight).value }.max() ?? 0 }

    private func total(_ side: Double) -> Double { baseWeight + side * Double(sides) }

    private func greedy(upTo goal: Int) -> [Double] {
        var loaded: [Double] = []
        var side = 0.0
        for plate in plates {
            var count = 0
            while count < plate.perSide ?? .max, loaded.count < Self.sidePlates,
                  Hundredths(of: total(side + plate.weight)).value <= goal {
                loaded.append(plate.weight)
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
        let limit = min(limit, heaviestPlate * Self.sidePlates)
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

    /// "70 lb on both sides + 45 lb bar weight = 185 lb". A target the plates can't reach ends "- missing 5 lb"; one
    /// below the base ends "+ extra 45 lb", as MF showed for 0 lb.
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
