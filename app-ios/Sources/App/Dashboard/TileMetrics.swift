import Foundation

/// The numbers behind the Dashboard's Nutrition and Body Metrics sections, as pure functions so tests pin each to
/// literal values. See docs/decisions/nutrition.md "Dashboard".
enum TileMetrics {
    // MARK: Nutrients

    /// A logged day's amount of `id`, and the target that applied that day, for every day with entries or an override.
    static func nutrientDays(
        _ id: NutrientID, log: [NutritionLogDay], targets: (CalendarDay) -> NutrientTargets, calendar: Calendar
    ) -> (consumed: [DatedValue], target: [DatedValue]) {
        let logged = log.filter(\.isLogged)
        let consumed = logged.map { DatedValue(date: $0.day.date(in: calendar), value: $0.consumed.amount(of: id) ?? 0) }
        let target = logged.compactMap { day in
            targets(day.day).range(id).target.map { DatedValue(date: day.day.date(in: calendar), value: $0) }
        }
        return (consumed, target)
    }

    struct Tile: Equatable {
        var text: String?
        var unit: String
        var consumed: Double
        var range: NutrientRange
    }

    /// Percent and Remaining fall back to Consumed for a nutrient without a target, as MacroFactor disables them there.
    static func tile(consumed: Double, range: NutrientRange, display: NutritionCard.Display, unit: NutrientUnit) -> Tile {
        let format: (Double) -> String = { unit == .kcal ? $0.wholeText : $0.niceText }
        switch (display, range.target) {
        case let (.percent, target?) where target > 0:
            return Tile(text: (consumed / target * 100).wholeText, unit: "%", consumed: consumed, range: range)
        case let (.remaining, target?):
            return Tile(text: format(target - consumed), unit: "\(unit.rawValue) left", consumed: consumed, range: range)
        default:
            return Tile(text: format(consumed), unit: unit.rawValue, consumed: consumed, range: range)
        }
    }

    /// Each macro's share of the calories its grams carry (protein and carbs 4 kcal/g, fat 9), nil when nothing is logged.
    struct MacroSplit: Equatable {
        var protein: Double
        var fat: Double
        var carbs: Double

        var text: String {
            "\((protein * 100).wholeText)% P • \((fat * 100).wholeText)% F • \((carbs * 100).wholeText)% C"
        }
    }

    static func split(_ amounts: NutrientAmounts) -> MacroSplit? {
        let protein = (amounts[.protein] ?? 0) * 4
        let fat = (amounts[.fat] ?? 0) * 9
        let carbs = (amounts[.carbs] ?? 0) * 4
        let total = protein + fat + carbs
        guard total > 0 else { return nil }
        return MacroSplit(protein: protein / total, fat: fat / total, carbs: carbs / total)
    }

    // MARK: Body metrics

    /// A card's daily values: visual body fat in percent, tape measurements in centimeters, and the ratios as
    /// fractions. Waist to height needs the profile's height; waist to hip needs both on the same day.
    static func bodySeries(_ card: BodyMetricCard, metrics: [BodyMetric], heightCm: Double?, calendar: Calendar) -> [DatedValue] {
        func values(_ kind: BodyMetricKind) -> [CalendarDay: Double] {
            Dictionary(metrics.filter { $0.kind == kind }.map { ($0.day, $0.value) }, uniquingKeysWith: { $1 })
        }
        let byDay: [CalendarDay: Double]
        switch card {
        case .scaleWeight:
            byDay = [:]
        case .waistToHeight:
            guard let heightCm, heightCm > 0 else { return [] }
            byDay = values(.waist).mapValues { $0 / heightCm }
        case .waistToHip:
            let hips = values(.hips)
            byDay = Dictionary(uniqueKeysWithValues: values(.waist).compactMap { day, waist in
                hips[day].flatMap { $0 > 0 ? (day, waist / $0) : nil }
            })
        default:
            byDay = card.kind.map(values) ?? [:]
        }
        return byDay.keys.sorted().map { DatedValue(date: $0.date(in: calendar), value: byDay[$0]!) }
    }
}

extension BodyMetricCard {
    /// The stored kind behind a card, nil for scale weight (in `body_weights`) and the derived ratios.
    var kind: BodyMetricKind? {
        switch self {
        case .scaleWeight, .waistToHeight, .waistToHip: nil
        case .visualBodyFat: .visualBodyFat
        case .neck: .neck
        case .shoulders: .shoulders
        case .bust: .bust
        case .chest: .chest
        case .waist: .waist
        case .hips: .hips
        case .leftBicep: .leftBicep
        case .rightBicep: .rightBicep
        case .leftForearm: .leftForearm
        case .rightForearm: .rightForearm
        case .leftWrist: .leftWrist
        case .rightWrist: .rightWrist
        case .leftThigh: .leftThigh
        case .rightThigh: .rightThigh
        case .leftCalf: .leftCalf
        case .rightCalf: .rightCalf
        case .leftAnkle: .leftAnkle
        case .rightAnkle: .rightAnkle
        }
    }

    var title: String {
        switch self {
        case .scaleWeight: "Scale Weight"
        case .visualBodyFat: "Visual Body Fat"
        case .waistToHeight: "Waist to Height"
        case .waistToHip: "Waist to Hip"
        default: kind!.title
        }
    }

    var isLength: Bool { kind.map(\.isLength) ?? false }

    func unit(weight: WeightUnit, height: NutritionSettings.HeightUnit) -> String {
        switch self {
        case .scaleWeight: weight.rawValue
        case .visualBodyFat: "%"
        case .waistToHeight, .waistToHip: "ratio"
        default: height.lengthLabel
        }
    }

    /// The cards a layout may show: scale weight and visual body fat always, a tape measurement once Data Visibility
    /// turns it on, and a ratio once its measurements are on.
    static func available(visible: Set<BodyMetricKind>) -> [BodyMetricCard] {
        allCases.filter { card in
            switch card {
            case .scaleWeight, .visualBodyFat: true
            case .waistToHeight: visible.contains(.waist)
            case .waistToHip: visible.contains(.waist) && visible.contains(.hips)
            default: card.kind.map(visible.contains) ?? false
            }
        }
    }

    var group: BodyMetricGroup {
        switch self {
        case .scaleWeight: .weightAndBodyFat
        case .waistToHeight, .waistToHip: .ratios
        default: kind!.group!
        }
    }
}
