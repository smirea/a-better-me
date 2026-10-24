import Foundation

/// A rep range three wide: MF's every generated range is `min...min + 2`.
struct RepTier: Hashable {
    var min: Int
    var max: Int { min + 2 }

    static let t7 = RepTier(min: 7), t9 = RepTier(min: 9), t11 = RepTier(min: 11), t14 = RepTier(min: 14), t19 = RepTier(min: 19)

    /// The five-value ladder each starting tier owns, from the heaviest week (`v4`) to the lightest (`v0`), as the
    /// research spec's §1.5 measured it.
    var ladder: [RepTier] {
        switch min {
        case 7: [7, 5, 4, 4, 2].map(RepTier.init)
        case 9: [9, 7, 6, 6, 4].map(RepTier.init)
        case 11: [11, 9, 8, 7, 5].map(RepTier.init)
        case 14: [14, 12, 10, 9, 7].map(RepTier.init)
        case 19: [19, 16, 14, 12, 9].map(RepTier.init)
        default: Array(repeating: self, count: 5)
        }
    }
}

/// The role a generated exercise plays, which fixes its reps and RIR. Pull compounds are their own roles because MF
/// gives them a lighter RIR track and often a higher rep tier.
enum GeneratedRole: Hashable, CaseIterable {
    case primary, secondary, pullPrimary, pullSecondary, accessory

    var isAccessory: Bool { self == .accessory }
    var isPull: Bool { self == .pullPrimary || self == .pullSecondary }
    var isPrimary: Bool { self == .primary || self == .pullPrimary }

    init(pattern: MovementPattern, slot: SlotRole) {
        switch (pattern.isPull, slot) {
        case (true, .primary): self = .pullPrimary
        case (true, _): self = .pullSecondary
        case (false, .primary): self = .primary
        case (false, _): self = .secondary
        }
    }
}

/// Reps per cycle and RIR per set for a generated exercise (research spec §1.5 and §1.6).
enum RepScheme {
    static let cycles = 7

    /// Cycle 1 tier under linear and undulating progressions. "Both" takes strength primaries and hypertrophy for the
    /// rest.
    static func startTier(goal: TrainingGoal, role: GeneratedRole) -> RepTier {
        switch (goal, role) {
        case (.hypertrophy, .primary): .t11
        case (.hypertrophy, .secondary), (.hypertrophy, .pullPrimary), (.hypertrophy, .pullSecondary): .t14
        case (.hypertrophy, .accessory): .t19
        case (.strength, .primary): .t7
        case (.strength, .secondary): .t9
        case (.strength, .pullPrimary): .t11
        case (.strength, .pullSecondary), (.strength, .accessory): .t14
        case (.both, .primary): .t7
        case (.both, .secondary), (.both, .pullSecondary): .t14
        case (.both, .pullPrimary): .t11
        case (.both, .accessory): .t19
        }
    }

    /// Static keeps one rep range for the whole program. Hypertrophy is measured (P7); strength and both take the
    /// same step down the ladder, which is a guess until MF generates them.
    static func staticTier(goal: TrainingGoal, role: GeneratedRole) -> RepTier {
        switch (goal, role) {
        case (.hypertrophy, .primary): return .t7
        case (.hypertrophy, .secondary), (.hypertrophy, .pullPrimary): return .t9
        case (.hypertrophy, .pullSecondary): return .t11
        case (.hypertrophy, .accessory): return .t14
        default:
            let start = startTier(goal: goal, role: role)
            return role.isAccessory ? start.ladder[2] : start.ladder[3]
        }
    }

    /// Ladder indexes for cycles 1 to 7. Linear and no preference are the same sequence.
    static func ladderIndexes(_ progression: RepProgression) -> [Int] {
        switch progression {
        case .noPreference, .linear: [0, 0, 1, 2, 3, 4, 4]
        case .reverseLinear: [4, 4, 3, 2, 1, 0, 0]
        case .undulating: [0, 2, 4, 0, 3, 1, 4]
        case .constant: Array(repeating: 0, count: cycles)
        }
    }

    /// The rep tier of every cycle, 1 to 7.
    static func tiers(goal: TrainingGoal, role: GeneratedRole, progression: RepProgression) -> [RepTier] {
        if progression == .constant {
            return Array(repeating: staticTier(goal: goal, role: role), count: cycles)
        }
        let ladder = startTier(goal: goal, role: role).ladder
        return ladderIndexes(progression).map { ladder[$0] }
    }

    /// RIR per set. Track A is push and leg compounds, track B pulls (one lower), track C accessories and core.
    static func rir(role: GeneratedRole, sets: Int) -> [Int] {
        let trackA: [Int] = switch sets {
        case ...1: [2]
        case 2: [2, 1]
        case 3: [3, 2, 1]
        case 4: [3, 2, 2, 1]
        default: [3, 2] + Array(repeating: 2, count: sets - 4) + [1, 1]
        }
        switch role {
        case .primary, .secondary: return trackA
        case .pullPrimary, .pullSecondary: return trackA.map { max(0, $0 - 1) }
        case .accessory:
            return switch sets {
            case ...1: [0]
            case 2: [0, 0]
            default: [1] + Array(repeating: 0, count: sets - 1)
            }
        }
    }

    /// The sets of one cycle: `sets` standard sets at `tier` with the role's RIR track, no rest of their own.
    static func sets(count: Int, tier: RepTier, role: GeneratedRole) -> [WorkoutSet] {
        zip(0..<count, rir(role: role, sets: count)).map { _, rir in
            WorkoutSet(target: SetTarget(repsMin: tier.min, repsMax: tier.max, rir: rir))
        }
    }

    /// Every cycle's sets for one generated exercise, index 0 for cycle 1.
    static func cycleTargets(count: Int, goal: TrainingGoal, role: GeneratedRole, progression: RepProgression) -> [CycleTargets] {
        tiers(goal: goal, role: role, progression: progression).map { CycleTargets(sets: sets(count: count, tier: $0, role: role)) }
    }
}

/// MF's deload week, derived from the week it follows (research spec §1.9): drop the last set, add 3 RIR capped at 6+,
/// and scale both ends of the rep range by 0.8, rounding half up.
enum DeloadRule {
    static func apply(to sets: [WorkoutSet]) -> [WorkoutSet] {
        let kept = sets.count > 1 ? Array(sets.dropLast()) : sets
        return kept.map { set in
            var set = set
            set.log = nil
            if var target = set.target {
                target.repsMin = target.repsMin.map(scale)
                target.repsMax = target.repsMax.map(scale)
                target.rir = target.rir.map { min($0 + 3, 6) }
                set.target = target
            }
            return set
        }
    }

    private static func scale(_ reps: Int) -> Int {
        Int((Double(reps) * 0.8).rounded(.toNearestOrAwayFromZero))
    }
}
