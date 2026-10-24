import Foundation

/// The Workout tab's built-in sections. `yourSections` is the slot the custom sections draw in, or its empty state when
/// there are none.
enum WorkoutSection: String, Codable, CaseIterable, Identifiable {
    case activeProgram, library, yourSections

    var id: String { rawValue }

    var title: String {
        switch self {
        case .activeProgram: "Active Program"
        case .library: "Workout Library"
        case .yourSections: "Your Sections"
        }
    }

    var icon: String {
        switch self {
        case .activeProgram: "chevron.right.2"
        case .library: "book"
        case .yourSections: "rectangle.split.1x2"
        }
    }
}

/// A section the owner added with New Section: a name and the library workouts filed under it. A workout sits in at
/// most one section and leaves the Workout Library list while it does.
struct CustomWorkoutSection: Codable, Hashable, Identifiable {
    var id = UUID()
    var name: String
    var templateIDs: [UUID] = []
    var collapsed = false
}

extension CustomWorkoutSection {
    /// The settings merge supplies no defaults inside the custom list, so optional keys default here.
    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        templateIDs = try container.decodeIfPresent([UUID].self, forKey: .templateIDs) ?? []
        collapsed = try container.decodeIfPresent(Bool.self, forKey: .collapsed) ?? false
    }
}

/// Customize Sections and the custom sections, encoded whole into `settings.workout.sections`. `order` is always every
/// built-in exactly once: decoding normalizes it, so a layout saved by another build still draws.
struct WorkoutSectionsLayout: Codable, Hashable {
    var order = WorkoutSection.allCases
    var showsActiveProgram = true
    var custom: [CustomWorkoutSection] = []

    init() {}

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        order = Self.normalized(try container.decode([String].self, forKey: .order))
        showsActiveProgram = try container.decode(Bool.self, forKey: .showsActiveProgram)
        custom = try container.decode([CustomWorkoutSection].self, forKey: .custom)
    }

    /// Unknown or repeated sections are dropped and missing ones appended in their default order.
    static func normalized(_ stored: [String]) -> [WorkoutSection] {
        var seen = Set<WorkoutSection>()
        let known = stored.compactMap(WorkoutSection.init(rawValue:)).filter { seen.insert($0).inserted }
        return known + WorkoutSection.allCases.filter { !seen.contains($0) }
    }

    /// The sections the tab draws, in order.
    var visible: [WorkoutSection] {
        order.filter { $0 != .activeProgram || showsActiveProgram }
    }

    /// Every template filed under a custom section, which the Workout Library list leaves out.
    var filedTemplateIDs: Set<UUID> { Set(custom.flatMap(\.templateIDs)) }

    @discardableResult
    mutating func addSection(named name: String) -> CustomWorkoutSection.ID {
        let section = CustomWorkoutSection(name: name.trimmingCharacters(in: .whitespacesAndNewlines))
        custom.append(section)
        return section.id
    }

    mutating func rename(_ id: CustomWorkoutSection.ID, to name: String) {
        guard let index = custom.firstIndex(where: { $0.id == id }) else { return }
        custom[index].name = name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// The section's workouts go back to the Workout Library, because filing is only ever the section's own list.
    mutating func deleteSection(_ id: CustomWorkoutSection.ID) {
        custom.removeAll { $0.id == id }
    }

    /// Files `templateID` under `sectionID`, taking it out of any other section first, or takes it out of `sectionID`.
    mutating func file(_ templateID: UUID, in sectionID: CustomWorkoutSection.ID, _ filed: Bool) {
        guard let index = custom.firstIndex(where: { $0.id == sectionID }) else { return }
        for other in custom.indices {
            custom[other].templateIDs.removeAll { $0 == templateID }
        }
        if filed { custom[index].templateIDs.append(templateID) }
    }

    mutating func toggleCollapsed(_ id: CustomWorkoutSection.ID) {
        guard let index = custom.firstIndex(where: { $0.id == id }) else { return }
        custom[index].collapsed.toggle()
    }
}
