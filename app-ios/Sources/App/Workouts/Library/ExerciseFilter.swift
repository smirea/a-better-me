import SwiftUI

struct ExerciseFilter: Equatable {
    var type: RestCategory?
    var laterality: Laterality?
    var resistance: EquipmentChoice?
    var support: EquipmentChoice?
    var rangeOfMotion = ExerciseFilter.fullRange
    var muscle: Muscle?
    /// Narrows the list to what this gym's equipment allows. It is a context rather than a filter, so it never counts
    /// as active and Reset keeps it.
    var gymID: UUID?

    static let fullRange = 0...5

    var isActive: Bool { self != ExerciseFilter(gymID: gymID) }

    func matches(_ exercise: Exercise) -> Bool {
        if let type, exercise.restCategory != type { return false }
        if let laterality, exercise.laterality != laterality { return false }
        if let resistance, !resistance.matches(exercise.resistanceEquipmentIDs) { return false }
        if let support, !support.matches(exercise.supportEquipmentIDs) { return false }
        if rangeOfMotion != Self.fullRange, !rangeOfMotion.contains(exercise.rangeOfMotion ?? 0) { return false }
        if let muscle, !exercise.primaryMuscles.contains(muscle), !exercise.secondaryMuscles.contains(muscle) { return false }
        return true
    }
}

/// A piece of equipment as the filters list it: the plural ("Dumbbells") also matches exercises that name its singular.
struct EquipmentChoice: Equatable {
    let id: String
    let matching: Set<String>

    func matches(_ options: [[String]]) -> Bool {
        options.contains { !matching.isDisjoint(with: $0) }
    }
}

/// Every word of the query must appear in the name or one of the alternative names.
struct ExerciseSearch {
    let words: [String]

    init(_ query: String) {
        words = query.split(whereSeparator: \.isWhitespace).map(String.init)
    }

    var isEmpty: Bool { words.isEmpty }

    func matches(_ exercise: Exercise) -> Bool {
        words.allSatisfy { word in
            ([exercise.name] + exercise.alternativeNames).contains { $0.localizedStandardContains(word) }
        }
    }

    func highlighted(_ name: String) -> AttributedString {
        var text = AttributedString(name)
        for word in words {
            var searchStart = text.startIndex
            while let range = text[searchStart...].range(of: word, options: [.caseInsensitive, .diacriticInsensitive]) {
                text[range].font = AppFont.title(15)
                searchStart = range.upperBound
            }
        }
        return text
    }
}

struct ExerciseGroup: Identifiable {
    let category: ExerciseCategory
    let exercises: [Exercise]

    var id: ExerciseCategory { category }

    /// `exercises` must already be in `ranked` order, as `ExerciseCatalog.all` is; grouping keeps it.
    static func grouping(_ exercises: [Exercise]) -> [ExerciseGroup] {
        let byCategory = Dictionary(grouping: exercises, by: \.category)
        return ExerciseCategory.allCases.compactMap { category in
            byCategory[category].map { ExerciseGroup(category: category, exercises: $0) }
        }
    }
}

extension ExerciseGroup {
    static func ranksBefore(_ a: Exercise, _ b: Exercise) -> Bool {
        a.searchBoost != b.searchBoost
            ? a.searchBoost > b.searchBoost
            : a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
    }

    static func ranked(_ exercises: [Exercise]) -> [Exercise] {
        exercises.sorted(by: ranksBefore)
    }

    /// `ranked` for exercises already sorted by name, without comparing names again.
    static func ranked(nameSorted exercises: [Exercise]) -> [Exercise] {
        Dictionary(grouping: exercises, by: \.searchBoost).sorted { $0.key > $1.key }.flatMap(\.value)
    }

    /// Merges two lists that are each in `ranked` order.
    static func merge(_ a: [Exercise], _ b: [Exercise]) -> [Exercise] {
        var merged: [Exercise] = []
        merged.reserveCapacity(a.count + b.count)
        var i = a.startIndex, j = b.startIndex
        while i < a.endIndex, j < b.endIndex {
            if ranksBefore(b[j], a[i]) {
                merged.append(b[j])
                j += 1
            } else {
                merged.append(a[i])
                i += 1
            }
        }
        return merged + a[i...] + b[j...]
    }

    /// The browser's list: `ranked` exercises narrowed to `scope`, the filters, the gym, and the search, by category.
    static func browse(
        _ ranked: [Exercise], scope: BrowseScope, filter: ExerciseFilter, search: ExerciseSearch, availability: GymAvailability?
    ) -> (scoped: [Exercise], groups: [ExerciseGroup]) {
        let scoped = ranked.filter(scope.contains)
        let shown = scoped.filter { filter.matches($0) && search.matches($0) && availability?.isAvailable($0) != false }
        return (scoped, grouping(shown))
    }
}

/// Which exercises a browser lists before its filters and search apply.
enum BrowseScope: Hashable {
    case except(Set<ExerciseID>)
    case only(Set<ExerciseID>)

    func contains(_ exercise: Exercise) -> Bool {
        switch self {
        case .except(let ids): !ids.contains(exercise.id)
        case .only(let ids): ids.contains(exercise.id)
        }
    }
}

extension ExerciseCategory {
    /// Mirrors `pickerCategories` in `scripts/catalog.ts`, for custom exercises built from one piece of equipment.
    init(equipmentCategory: String) {
        self = switch equipmentCategory {
        case "Cable Machines", "Plate Loaded Machines", "Pin Loaded Machines": .machines
        case "Cardio": .cardio
        case "Free Weights", "Loadable Bars", "Fixed Weight Bars", "Loadable Accessories": .freeWeights
        case "Body Weights", "Bands & Ropes", "Accessories & Functional", "Benches & Racks", "Bodyweight": .bodyweight
        default: .other
        }
    }
}

enum EquipmentCategoryOrder {
    static let names = [
        "Bodyweight", "Free Weights", "Loadable Bars", "Fixed Weight Bars", "Loadable Accessories", "Bands & Ropes",
        "Body Weights", "Benches & Racks", "Accessories & Functional", "Cable Machines", "Plate Loaded Machines",
        "Pin Loaded Machines", "Cardio", "Other",
    ]

    static func index(_ name: String) -> Int { names.firstIndex(of: name) ?? names.count }
}
