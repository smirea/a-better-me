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
