import Foundation

/// One row of a nutrient table: a section's label, or a nutrient with how deep it nests and whether it is the last
/// of its section, which draws the rule under it.
enum NutrientListRow: Hashable, Identifiable {
    case label(NutrientTableSection)
    case nutrient(Nutrient, depth: Int, endsSection: Bool)

    var id: Self { self }

    /// The table's nutrients that `shows` keeps, each section's label before its own. The first section reads as the
    /// label's top, so it has none, and a section that keeps nothing is left out.
    static func rows(shows: (Nutrient) -> Bool) -> [NutrientListRow] {
        NutrientTableSection.allCases.flatMap { section -> [NutrientListRow] in
            let lines = section.lines.compactMap { line in NutrientRegistry.nutrient(line.id).map { ($0, line.depth) } }.filter { shows($0.0) }
            guard !lines.isEmpty else { return [] }
            let rows = lines.enumerated().map { index, line in
                NutrientListRow.nutrient(line.0, depth: line.1, endsSection: index == lines.count - 1)
            }
            return (section == .facts ? [] : [.label(section)]) + rows
        }
    }

    /// Every nutrient, for a list that shows each whether or not it was reported.
    static let all = rows { _ in true }
    static let macros = rows { NutrientID.summaryChoices.contains($0.id) }

    /// A food's table: its significant nutrients, or with `all` every one it reports and, when `listsUnreported`, the
    /// rest as well. `hidden` counts what `all` adds, which the table offers to show.
    static func rows(for amounts: NutrientAmounts, all: Bool, listsUnreported: Bool) -> (rows: [NutrientListRow], hidden: Int) {
        var hidden = 0
        let rows = rows { nutrient in
            let amount = amounts.amount(of: nutrient.id)
            let significant = amount.map { !nutrient.isInsignificant($0) } ?? false
            let offered = amount != nil || listsUnreported
            if offered, !significant { hidden += 1 }
            return significant || (all && offered)
        }
        return (rows, hidden)
    }
}

extension Nutrient {
    /// Too little to matter, so a food's table hides it until asked (the owner, 2026-11-27: "hide very small serving
    /// sizes under .2 g"). Calories and the three macros always matter. A vitamin or mineral with a daily target is
    /// insignificant under 2% of the lower adult target, the FDA's line for "not a significant source", since 0.2 mg
    /// of copper is a fifth of a day's while 0.2 mg of calcium is nothing. Anything else is insignificant under 0.2 of
    /// its unit.
    func isInsignificant(_ amount: Double) -> Bool {
        if NutrientID.macros.contains(id) { return false }
        if unit == .mg || unit == .mcg, let target = [defaults?.male.target, defaults?.female.target].compactMap(\.self).min() {
            return amount < target * 0.02
        }
        return amount < 0.2
    }
}

/// A nutrient table's sections, read like a Nutrition Facts label: calories and the macros with what they contain,
/// then vitamins, minerals, and the rest, each section ruled off from the next.
enum NutrientTableSection: String, CaseIterable, Hashable {
    case facts = "Calories & Macros"
    case vitamins = "Vitamins"
    case minerals = "Minerals"
    case other = "Other"

    /// Each nutrient with how deep it nests: the US label's order (fat, cholesterol, sodium, carbs, protein; vitamins
    /// and minerals in the FDA's listing order), with the registry's extras placed under what holds them.
    fileprivate var lines: [(id: NutrientID, depth: Int)] {
        switch self {
        case .facts:
            [
                (.energy, 0),
                (.fat, 0), ("606", 1), ("693", 1), ("646", 1), ("645", 1), ("901", 1), ("851", 2), ("629", 2), ("621", 2), ("902", 1),
                ("601", 0),
                ("307", 0),
                (.carbs, 0), (.fiber, 1), ("269", 1), ("539", 2), (.sugarAlcohols, 1), ("er", 2), ("xy", 2), ("ma", 2), ("so", 2), (.allulose, 1),
                ("209", 1), (.netCarbs, 1),
                (.protein, 0), ("507", 1), ("512", 1), ("503", 1), ("504", 1), ("505", 1), ("506", 1), ("508", 1), ("502", 1), ("501", 1), ("509", 1), ("510", 1),
            ]
        case .vitamins:
            ["320", "401", "328", "323", "430", "404", "405", "406", "415", "417", "418", "410", "421"].map { ($0, 0) }
        case .minerals:
            ["301", "303", "306", "305", "304", "309", "317", "312", "315"].map { ($0, 0) }
        case .other:
            [(.alcohol, 0), ("262", 0), ("255", 0)]
        }
    }

    private static let depths: [NutrientID: Int] = Dictionary(
        allCases.flatMap { $0.lines.map { ($0.id, $0.depth) } }, uniquingKeysWith: { first, _ in first }
    )

    /// How deep the table nests a nutrient under what holds it: 0 for a macro, 2 for sugars added or erythritol.
    static func depth(of id: NutrientID) -> Int { depths[id] ?? 0 }
}
