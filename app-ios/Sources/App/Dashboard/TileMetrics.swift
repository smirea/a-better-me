import Foundation

/// The numbers behind the Dashboard's Nutrition and Body Metrics sections, as pure functions so tests pin each to
/// literal values. See docs/decisions/nutrition.md "Dashboard".
enum TileMetrics {
    // MARK: Nutrients

    /// Calories and the macros take their target from the plan; every other nutrient from its goals and the registry.
    static func range(
        _ id: NutrientID, on day: CalendarDay, plans: [NutritionPlan], goals: [NutrientGoal], sex: BodySex, weightKg: Double?
    ) -> NutrientRange {
        guard NutritionMetrics.macros.contains(id) else {
            return NutrientGoal.range(id, on: day, goals: goals, sex: sex, weightKg: weightKg)
        }
        let target = NutritionMetrics.DayNutrition(day: day, consumed: [:], target: NutritionPlan.effective(on: day, in: plans)?.target(on: day)).target(id)
        return NutrientRange(target: target)
    }

    /// A logged day's amount of `id`, and the target that applied that day, for every day with entries or an override.
    static func nutrientDays(
        _ id: NutrientID, log: [NutritionLogDay], plans: [NutritionPlan], goals: [NutrientGoal], sex: BodySex, weightKg: Double?,
        calendar: Calendar
    ) -> (consumed: [DatedValue], target: [DatedValue]) {
        let logged = log.filter { $0.entryCount > 0 || $0.hasOverride }
        let consumed = logged.map { DatedValue(date: $0.day.date(in: calendar), value: $0.consumed.amount(of: id) ?? 0) }
        let target = logged.compactMap { day in
            range(id, on: day.day, plans: plans, goals: goals, sex: sex, weightKg: weightKg).target.map { DatedValue(date: day.day.date(in: calendar), value: $0) }
        }
        return (consumed, target)
    }

    struct Tile: Equatable {
        var text: String?
        var unit: String
        /// How full the bar is, 0 to 1.
        var fill: Double
        /// Where the target tick sits, nil without a target.
        var tick: Double?
    }

    /// MacroFactor draws the target tick at about 59% of the bar, leaving room to show going over.
    static let tickPosition = 0.59

    /// Percent and Remaining fall back to Consumed for a nutrient without a target, as MacroFactor disables them there.
    static func tile(consumed: Double, target: Double?, display: NutritionCard.Display, unit: String) -> Tile {
        let scale = target.map { $0 / tickPosition } ?? max(consumed, 1)
        let fill = min(max(consumed / max(scale, 1e-9), 0), 1)
        let tick = target.map { _ in tickPosition }
        let format: (Double) -> String = { unit == "kcal" || unit == "mg" || unit == "mcg" ? Int($0.rounded()).formatted() : $0.dashboardText }
        switch (display, target) {
        case let (.percent, target?) where target > 0:
            return Tile(text: Int((consumed / target * 100).rounded()).formatted(), unit: "%", fill: fill, tick: tick)
        case let (.remaining, target?):
            return Tile(text: format(target - consumed), unit: "\(unit) left", fill: fill, tick: tick)
        default:
            return Tile(text: format(consumed), unit: unit, fill: fill, tick: tick)
        }
    }

    /// Each macro's share of the calories its grams carry (protein and carbs 4 kcal/g, fat 9), nil when nothing is logged.
    struct MacroSplit: Equatable {
        var protein: Double
        var fat: Double
        var carbs: Double

        var text: String {
            "\(Int((protein * 100).rounded()))% P • \(Int((fat * 100).rounded()))% F • \(Int((carbs * 100).rounded()))% C"
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

    var group: String {
        switch self {
        case .scaleWeight, .visualBodyFat: "Weight & Body Fat"
        case .neck, .shoulders, .bust, .chest, .waist, .hips: "Upper Body"
        case .leftBicep, .rightBicep, .leftForearm, .rightForearm, .leftWrist, .rightWrist: "Arms"
        case .leftThigh, .rightThigh, .leftCalf, .rightCalf, .leftAnkle, .rightAnkle: "Legs"
        case .waistToHeight, .waistToHip: "Ratios"
        }
    }
}

extension BodyMetricKind {
    var isLength: Bool { self != .visualBodyFat && self != .steps }
}

extension NutritionSettings.HeightUnit {
    var lengthLabel: String { self == .centimeters ? "cm" : "in" }

    func fromCm(_ cm: Double) -> Double { self == .centimeters ? cm : cm / 2.54 }
    func toCm(_ value: Double) -> Double { self == .centimeters ? value : value * 2.54 }
}
