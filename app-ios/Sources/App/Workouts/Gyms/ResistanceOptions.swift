import Foundation

/// One of an exercise's resistance or support options as the live workout's Equipment sheet lists it, numbered from 1
/// the way MF labels a missing one ("Option 5 not available in your gym").
struct EquipmentChoiceOption: Identifiable, Equatable {
    var number: Int
    var ids: [EquipmentID]
    var isAvailable: Bool

    var id: Int { number }
    var unavailableLabel: String { "Option \(number) not available in your gym" }

    /// Each alternative marked by whether `availability` provides all of its items. Without a gym every option is
    /// available.
    static func list(_ alternatives: [[EquipmentID]], in availability: GymAvailability?) -> [EquipmentChoiceOption] {
        alternatives.enumerated().map { index, ids in
            EquipmentChoiceOption(number: index + 1, ids: ids, isAvailable: availability.map { ids.allSatisfy($0.provides) } ?? true)
        }
    }

    /// The option in use: the stored choice while the exercise still offers it, else the first the gym provides,
    /// else the first. A choice outlives a swap only when the new exercise has the same option.
    static func chosen(_ choice: [EquipmentID]?, among options: [EquipmentChoiceOption]) -> [EquipmentID]? {
        if let choice, options.contains(where: { $0.ids == choice }) { return choice }
        return (options.first(where: \.isAvailable) ?? options.first)?.ids
    }
}

extension Exercise {
    func resistanceOptions(in availability: GymAvailability?) -> [EquipmentChoiceOption] {
        EquipmentChoiceOption.list(resistanceEquipmentIDs, in: availability)
    }

    func supportOptions(in availability: GymAvailability?) -> [EquipmentChoiceOption] {
        EquipmentChoiceOption.list(supportEquipmentIDs, in: availability)
    }

    func chosenEquipment(_ choice: [EquipmentID]?, in availability: GymAvailability?) -> [EquipmentID]? {
        EquipmentChoiceOption.chosen(choice, among: resistanceOptions(in: availability))
    }

    func chosenSupport(_ choice: [EquipmentID]?, in availability: GymAvailability?) -> [EquipmentID]? {
        EquipmentChoiceOption.chosen(choice, among: supportOptions(in: availability))
    }

    /// Whether the Equipment chip has anything to pick: more than one resistance or support option.
    var hasEquipmentChoice: Bool { resistanceEquipmentIDs.count > 1 || supportEquipmentIDs.count > 1 }
}

/// The load each item has for one exercise: its Equipment Weights override, else the gym's load, else MF's default.
/// An item the gym doesn't select loads nothing unless the exercise overrides it, so a gym without plates has no
/// plates to put on the bar.
struct GymLoads {
    var gym: GymProfile?
    var overrides: [EquipmentID: EquipmentLoad]
    var catalog: [EquipmentID: Equipment]

    func load(_ id: EquipmentID) -> EquipmentLoad? {
        let listed = catalog.values.first { $0.pluralOf == id }?.id ?? id
        if let override = overrides[listed] { return override }
        guard let gym else { return GymDefaults.load(for: listed) }
        guard gym.equipment[listed] != nil else { return nil }
        return GymDefaults.effectiveLoad(listed, in: gym)
    }
}

extension Loading {
    /// MF's Weight Plates, which plate-loaded bars and machines take even when their option doesn't name them.
    static let weightPlatesID: EquipmentID = "25a5c6f170d880c1a55ac08cf52671ab"
    private static let barCategory = "Loadable Bars"
    private static let machineCategory = "Plate Loaded Machines"
    private static let accessoryCategory = "Loadable Accessories"
    private static let plateLoadedCategories: Set<String> = [barCategory, machineCategory, accessoryCategory]

    /// The option's items plus the Weight Plates a bar or plate-loaded machine takes, as MF names the option
    /// ("Plate-Loaded Cable Crossover, Weight Plates").
    static func itemsLoaded(by ids: [EquipmentID], catalog: [EquipmentID: Equipment]) -> [EquipmentID] {
        let takesPlates = ids.contains { catalog[$0].map { plateLoadedCategories.contains($0.category) } ?? false }
        return takesPlates && !ids.contains(weightPlatesID) ? ids + [weightPlatesID] : ids
    }

    /// A bar or plate-loaded machine loads plates on its base. Otherwise the first other item with weights or a pin
    /// stack decides the steps, before a loadable accessory, which in "Dumbbells, Fat Grip Attachments" only changes the
    /// grip but in "Dip Belt, Weight Plates" carries the plates. Bands and items without a load give `nil`, and the
    /// stepper falls back to the increment. A `perSide` weight field logs one side, so it loads one side of the base.
    static func resolve(
        option ids: [EquipmentID], catalog: [EquipmentID: Equipment], unit: WeightUnit, perSide: Bool = false,
        calculator: PlateCalculatorOptions = PlateCalculatorOptions(), barWeightKg: [EquipmentID: Double] = [:],
        load: (EquipmentID) -> EquipmentLoad?
    ) -> Loading? {
        let items = ids.compactMap { catalog[$0] }
        let context = PlateContext(unit: unit, perSide: perSide, calculator: calculator, barWeightKg: barWeightKg)
        if let base = items.first(where: { $0.category == barCategory || $0.category == machineCategory }) {
            return plates(on: base, context, load: load)
        }
        func firstSteps(_ candidates: [Equipment]) -> Loading? {
            for item in candidates {
                if let fixed = load(item.id).flatMap({ steps(of: $0, unit: unit) }) { return .steps(fixed) }
            }
            return nil
        }
        if let fixed = firstSteps(items.filter { $0.id != weightPlatesID && $0.category != accessoryCategory }) { return fixed }
        if let accessory = items.first(where: { $0.category == accessoryCategory }) {
            return plates(on: accessory, context, load: load)
        }
        return firstSteps(items)
    }

    private struct PlateContext {
        var unit: WeightUnit
        var perSide: Bool
        var calculator: PlateCalculatorOptions
        var barWeightKg: [EquipmentID: Double]
    }

    /// The gym's Bumper Plates, which join the Weight Plates when the gym's Include Bumper Plates is on.
    static let bumperPlatesID: EquipmentID = "25a5c6f170d8805b8c95e7e5b4e8a989"

    private static func plates(on base: Equipment, _ context: PlateContext, load: (EquipmentID) -> EquipmentLoad?) -> Loading {
        let unit = context.unit
        let isBar = base.category == barCategory
        let sides = isBar || base.plateLaterality == .perSide ? 2 : 1
        var baseWeights: [Double] = []
        let baseKg: Double?
        switch load(base.id) {
        case let .weights(options)?:
            baseWeights = Set(options.map(\.kg)).sorted().map(unit.fromKg)
            let chosen = context.barWeightKg[base.id].flatMap { choice in options.first { abs($0.kg - choice) < 0.005 }?.kg }
            baseKg = chosen ?? options.map(\.kg).max()
        case let .base(kg)?:
            baseKg = kg
        default:
            baseKg = base.weightKg
        }
        let loaded = context.perSide ? 1 : sides
        func options(_ id: EquipmentID, isBumper: Bool) -> [(WeightOption, Bool)] {
            guard case let .weights(options)? = load(id) else { return [] }
            return options.map { ($0, isBumper) }
        }
        var listed = options(weightPlatesID, isBumper: false)
        if context.calculator.includeBumperPlates { listed += options(bumperPlatesID, isBumper: true) }
        if !context.calculator.allowMixedUnits {
            // Without Utilize Mixed Unit Plates only plates native to the display unit go on. A list with none of them
            // (the generated defaults are lb, so a kg owner's untouched gym) keeps every plate, since none would be worse.
            let native = listed.filter { $0.0.nativeUnit == nil || $0.0.nativeUnit == unit }
            if !native.isEmpty { listed = native }
        }
        let plates = listed.map { option, isBumper in
            PlateLoading.Plate(weight: unit.fromKg(option.kg), perSide: option.count.map { $0 / sides }, isBumper: isBumper)
        }
        let baseWeight = unit.fromKg(baseKg ?? 0) * Double(loaded) / Double(sides)
        return .plates(PlateLoading(base: isBar ? .bar : .machine, baseWeight: baseWeight, plates: plates, sides: loaded, baseID: base.id, baseWeights: baseWeights))
    }

    /// The loads a rack or pin stack offers, ascending. `nil` for an empty list, so the stepper keeps its increment.
    private static func steps(of load: EquipmentLoad, unit: WeightUnit) -> [Double]? {
        let kilograms: [Double]
        switch load {
        case let .weights(options):
            kilograms = options.map(\.kg)
        case let .ranges(ranges, micro):
            let positions = ranges.filter { $0.incrementKg > 0 && $0.maxKg >= $0.minKg }.flatMap { stride(from: $0.minKg, through: $0.maxKg + 1e-9, by: $0.incrementKg) }
            kilograms = (micro?.extrasKg ?? [0]).flatMap { extra in positions.map { $0 + extra } }
        case .base, .bands:
            kilograms = []
        }
        guard !kilograms.isEmpty else { return nil }
        // A pin position plus a micro weight can equal another position by a different sum, so steps dedupe in hundredths.
        var seen = Set<Int>()
        return kilograms.map(unit.fromKg).sorted().filter { seen.insert(Int(($0 * 100).rounded())).inserted }
    }
}
