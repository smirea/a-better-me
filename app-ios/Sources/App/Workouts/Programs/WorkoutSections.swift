import Foundation

/// The Workout tab's built-in sections. Custom sections are cut, so "Your Sections" only ever shows its empty state.
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

/// Customize Sections: the order of the three sections and whether Active Program shows. No synced table holds it, so
/// it lives in `@AppStorage` under `storageKey` as JSON.
struct WorkoutSectionsLayout: Codable, Hashable {
    static let storageKey = "workoutTab.sections"

    var order = WorkoutSection.allCases
    var showsActiveProgram = true

    init() {}

    /// Reads the stored JSON. Unknown or repeated sections are dropped and missing ones appended, so a layout saved by
    /// another build still names every section exactly once.
    init(storage: String) {
        guard let stored = try? JSONDecoder().decode(Stored.self, from: Data(storage.utf8)) else { return }
        var seen = Set<WorkoutSection>()
        let known = stored.order.compactMap(WorkoutSection.init(rawValue:)).filter { seen.insert($0).inserted }
        order = known + WorkoutSection.allCases.filter { !seen.contains($0) }
        showsActiveProgram = stored.showsActiveProgram ?? true
    }

    var storage: String {
        let stored = Stored(order: order.map(\.rawValue), showsActiveProgram: showsActiveProgram)
        return (try? JSONEncoder().encode(stored)).map { String(decoding: $0, as: UTF8.self) } ?? ""
    }

    /// The sections the tab draws, in order.
    var visible: [WorkoutSection] {
        order.filter { $0 != .activeProgram || showsActiveProgram }
    }

    private struct Stored: Codable {
        var order: [String]
        var showsActiveProgram: Bool?
    }
}
