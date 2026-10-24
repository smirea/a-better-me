import Foundation

/// One of an exercise's resistance options as the live workout's Equipment chip lists it, numbered from 1 the way MF
/// labels a missing one ("Option 5 not available in your gym").
struct ResistanceOption: Identifiable, Equatable {
    var number: Int
    var ids: [EquipmentID]
    var isAvailable: Bool

    var id: Int { number }
    var unavailableLabel: String { "Option \(number) not available in your gym" }
}

extension Exercise {
    /// Every resistance option, each marked by whether `availability` provides all of its items. Without a gym every
    /// option is available.
    func resistanceOptions(in availability: GymAvailability?) -> [ResistanceOption] {
        resistanceEquipmentIDs.enumerated().map { index, ids in
            ResistanceOption(number: index + 1, ids: ids, isAvailable: availability.map { ids.allSatisfy($0.provides) } ?? true)
        }
    }

    /// The option in use: the stored choice while the exercise still offers it, else the first the gym provides,
    /// else the first. A choice outlives a swap only when the new exercise has the same option.
    func chosenEquipment(_ choice: [EquipmentID]?, in availability: GymAvailability?) -> [EquipmentID]? {
        let options = resistanceOptions(in: availability)
        if let choice, options.contains(where: { $0.ids == choice }) { return choice }
        return (options.first(where: \.isAvailable) ?? options.first)?.ids
    }
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
    private static let plateLoadedCategories: Set<String> = [barCategory, "Plate Loaded Machines", "Loadable Accessories"]

    /// The option's items plus the Weight Plates a bar or plate-loaded machine takes, as MF names the option
    /// ("Plate-Loaded Cable Crossover, Weight Plates").
    static func itemsLoaded(by ids: [EquipmentID], catalog: [EquipmentID: Equipment]) -> [EquipmentID] {
        let takesPlates = ids.contains { catalog[$0].map { plateLoadedCategories.contains($0.category) } ?? false }
        return takesPlates && !ids.contains(weightPlatesID) ? ids + [weightPlatesID] : ids
    }

    /// A bar or plate-loaded machine loads plates on its base; otherwise the first item with weights or a pin stack
    /// decides the steps. Bands and items without a load give `nil`, and the stepper falls back to the increment.
    static func resolve(option ids: [EquipmentID], catalog: [EquipmentID: Equipment], unit: WeightUnit, load: (EquipmentID) -> EquipmentLoad?) -> Loading? {
        let items = ids.compactMap { catalog[$0] }
        if let base = items.first(where: { plateLoadedCategories.contains($0.category) }) {
            let isBar = base.category == barCategory
            let sides = isBar || base.plateLaterality == .perSide ? 2 : 1
            let baseKg: Double? = switch load(base.id) {
            case let .weights(options)?: options.map(\.kg).max()
            case let .base(kg)?: kg
            default: base.weightKg
            }
            var plates: [PlateLoading.Plate] = []
            if case let .weights(options)? = load(weightPlatesID) {
                plates = options.map { PlateLoading.Plate(weight: unit.fromKg($0.kg), perSide: $0.count.map { $0 / sides }) }
            }
            return .plates(PlateLoading(base: isBar ? .bar : .machine, baseWeight: unit.fromKg(baseKg ?? 0), plates: plates, sides: sides))
        }
        for item in items {
            switch load(item.id) {
            case let .weights(options)?:
                return .steps(Set(options.map { unit.fromKg($0.kg) }).sorted())
            case let .ranges(ranges)?:
                let positions = ranges.flatMap { range in
                    stride(from: range.minKg, through: range.maxKg + 1e-9, by: max(range.incrementKg, 1e-3)).map(unit.fromKg)
                }
                return .steps(Set(positions).sorted())
            default:
                continue
            }
        }
        return nil
    }
}
