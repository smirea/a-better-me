import SwiftUI

struct ExerciseFilter: Equatable {
    var type: RestCategory?
    var laterality: Laterality?
    var resistance: EquipmentChoice?
    var support: EquipmentChoice?
    var rangeOfMotion = ExerciseFilter.fullRange
    var muscle: Muscle?

    static let fullRange = 0...5

    var isActive: Bool { self != ExerciseFilter() }

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

    static func grouping(_ exercises: [Exercise]) -> [ExerciseGroup] {
        let byCategory = Dictionary(grouping: ranked(exercises), by: \.category)
        return ExerciseCategory.allCases.compactMap { category in
            byCategory[category].map { ExerciseGroup(category: category, exercises: $0) }
        }
    }
}

extension ExerciseGroup {
    static func ranked(_ exercises: [Exercise]) -> [Exercise] {
        exercises.sorted {
            $0.searchBoost != $1.searchBoost
                ? $0.searchBoost > $1.searchBoost
                : $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
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
