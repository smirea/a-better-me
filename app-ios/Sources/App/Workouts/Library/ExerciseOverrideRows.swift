import Foundation

extension ExerciseSettings {
    /// The library's Modified tab and Reset Defaults. The pinned note and Do Not Recommend are settings, not overrides.
    var isModified: Bool { restSeconds != nil || overrides != ExerciseOverrides() }
}

/// The rows of Exercise Settings > Exercise Overrides, in MF's order. Equipment Weights joins once the gym load editor
/// exists.
enum ExerciseOverrideRow: CaseIterable, Identifiable {
    case restTimer, restBetweenSides, expandRepRange, weightMatch, warmUpAutomation, warmUpScheme

    var id: Self { self }

    var title: String {
        switch self {
        case .restTimer: "Rest Timer"
        case .restBetweenSides: "Rest Between Left/Right Sets"
        case .expandRepRange: "Expand Rep Range"
        case .weightMatch: "Weight Match"
        case .warmUpAutomation: "Warm-Up Automation"
        case .warmUpScheme: "Warm-Up Scheme"
        }
    }

    var systemImage: String {
        switch self {
        case .restTimer: "timer"
        case .restBetweenSides: "arrow.left.arrow.right"
        case .expandRepRange: "arrow.left.and.right"
        case .weightMatch: "equal.square"
        case .warmUpAutomation: "flame"
        case .warmUpScheme: "list.number"
        }
    }

    /// The row's subtitle: "Default", or the overridden value.
    func summary(_ settings: ExerciseSettings?) -> String {
        guard let settings else { return "Default" }
        let overrides = settings.overrides
        let value: String? = switch self {
        case .restTimer: settings.restSeconds.map(Self.formatRest)
        case .restBetweenSides: overrides.restBetweenSides.map(Self.onOff)
        case .expandRepRange: overrides.expandRepRange.map(Self.onOff)
        case .weightMatch: overrides.weightMatch.map(Self.onOff)
        case .warmUpAutomation: overrides.warmUpAutomation.map(Self.name)
        case .warmUpScheme: overrides.warmUpScheme.map(Self.describe)
        }
        return value ?? "Default"
    }

    static func onOff(_ on: Bool) -> String { on ? "On" : "Off" }

    static func formatRest(_ seconds: Int) -> String {
        Duration.seconds(seconds).formatted(.time(pattern: .minuteSecond))
    }

    static func name(_ automation: WarmUpAutomation) -> String {
        switch automation {
        case .none: "None"
        case .smart: "Smart Warm-Up"
        case .scheme: "Scheme Warm-Up"
        }
    }

    /// "40% x 5, 60% x 5, 80% x 3", or "No warm-up sets".
    static func describe(_ scheme: [WarmUpStep]) -> String {
        scheme.isEmpty ? "No warm-up sets" : scheme.map { "\($0.percent)% x \($0.reps)" }.joined(separator: ", ")
    }
}
