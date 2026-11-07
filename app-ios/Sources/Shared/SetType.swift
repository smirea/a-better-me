enum SetType: String, Codable, CaseIterable {
    case standard, warmUp, drop, myo, failure

    var hasSubSets: Bool { self == .drop || self == .myo }
    /// Shown in the set circle instead of the set number.
    var badge: String? {
        switch self {
        case .standard: nil
        case .warmUp: "W"
        case .drop: "D"
        case .myo: "M"
        case .failure: "F"
        }
    }
}

extension SetType {
    var title: String {
        switch self {
        case .standard: "Standard Set"
        case .warmUp: "Warm-Up Set"
        case .drop: "Drop Set"
        case .myo: "Myo Set"
        case .failure: "Failure Set"
        }
    }

    /// What counts toward sets, volume, and progression: everything but warm-ups.
    var isWorking: Bool { self != .warmUp }
}

/// Reps in reserve as every surface writes them: six or more reads "6+".
enum RIR {
    static func text(_ rir: Int) -> String { rir >= 6 ? "6+" : "\(rir)" }
}
