import Foundation

/// The six compound movement patterns Smart Generation builds days from. Raw values are MF's `movementPattern` names,
/// the first entry of `Exercise.movementPatterns`.
enum MovementPattern: String, CaseIterable, Hashable {
    case horizontalPush = "Horizontal Push"
    case verticalPush = "Vertical Push"
    case horizontalPull = "Horizontal Pull"
    case verticalPull = "Vertical Pull"
    case squat = "Squat"
    case hipHinge = "Hip Hinge"

    var isPull: Bool { self == .horizontalPull || self == .verticalPull }
    var isLeg: Bool { self == .squat || self == .hipHinge }
    var isPush: Bool { self == .horizontalPush || self == .verticalPush }
}

enum SlotRole: Hashable {
    case primary, secondary, accessory
}

/// Which muscles a day's accessories may train.
enum DayRegion: Hashable {
    case full, upper, lower, push, pull, hinge, squat
    /// The secondaries-only upper day of the five-day splits, whose accessories start where push and pull left off.
    case upperSecondary
    /// The compound-free day of the "+ Accessories" splits: the muscles the other days leave short.
    case accessories

    var isLowerBody: Bool { self == .lower || self == .hinge || self == .squat }
}

/// One training day's compound skeleton: the primaries it always holds, then secondary tiers the weekly budget fills in
/// order. A tier lists one secondary slot per pattern it names.
struct DaySkeleton: Hashable {
    var name: String
    var region: DayRegion
    var primaries: [MovementPattern]
    var secondaryTiers: [[MovementPattern]]

    init(_ name: String, _ region: DayRegion, primaries: [MovementPattern], secondaries: [[MovementPattern]] = []) {
        self.name = name
        self.region = region
        self.primaries = primaries
        secondaryTiers = secondaries
    }
}

/// The week as MF lays it out: the workout and rest pattern per day count and each split's day skeletons
/// (research spec milestone-2.md §1.3 and §1.4).
enum SplitPlan {
    /// `true` is a workout day. The pattern depends on the day count only.
    static func weekPattern(daysPerWeek: Int) -> [Bool] {
        switch daysPerWeek {
        case ...2: [true, false, false, true, false, false, false]
        case 3: [true, false, true, false, true, false, false]
        case 4: [true, false, true, false, true, true, false]
        case 5: [true, true, true, true, true, false, false]
        default: [true, true, true, true, true, true, false]
        }
    }

    /// The wizard's split choices for a day count, "No preference" and "Full Body" first.
    static func options(daysPerWeek: Int) -> [ProgramSplit] {
        let specific: [ProgramSplit] = switch daysPerWeek {
        case ...2: [.upperLower, .pushPull]
        case 3: [.upperLowerFull, .pushPullLegs]
        case 4: [.upperLowerUpperLower, .pushPullHingeSquat, .pushPullLegsAccessories]
        case 5: [.upperLowerUpperLowerUpper, .pushPullHingeSquatAccessories, .pushPullLegsUpperLower]
        default: [.pushPullHingeSquatUpperLower, .pushPullLegsPushPullLegs]
        }
        return [.noPreference, .fullBody] + specific
    }

    /// "No preference" picks these (research spec §1.3: P15, P21, P22, P6, P14).
    static func resolve(_ split: ProgramSplit, daysPerWeek: Int) -> ProgramSplit {
        guard split == .noPreference else { return split }
        return switch daysPerWeek {
        case ...2: .fullBody
        case 3: .upperLowerFull
        case 4: .upperLowerUpperLower
        case 5: .pushPullLegsUpperLower
        default: .pushPullLegsPushPullLegs
        }
    }

    static func skeletons(for split: ProgramSplit, daysPerWeek: Int) -> [DaySkeleton] {
        let (hp, vp, hpl, vpl, sq, hh) = (
            MovementPattern.horizontalPush, MovementPattern.verticalPush, MovementPattern.horizontalPull,
            MovementPattern.verticalPull, MovementPattern.squat, MovementPattern.hipHinge
        )
        switch split {
        case .noPreference, .fullBody:
            return fullBody(daysPerWeek: daysPerWeek)
        case .upperLower:
            return [
                DaySkeleton("Upper", .upper, primaries: [hp, hpl, vp, vpl], secondaries: [[hp, hpl], [vp, vpl]]),
                DaySkeleton("Lower", .lower, primaries: [sq, hh], secondaries: [[sq, hh], [sq, hh]]),
            ]
        case .pushPull:
            return [
                DaySkeleton("Push", .push, primaries: [hp, vp, sq], secondaries: [[hp, vp, sq], [hp, vp, sq]]),
                DaySkeleton("Pull", .pull, primaries: [hpl, vpl, hh], secondaries: [[hpl, vpl, hh], [hpl, vpl, hh]]),
            ]
        case .upperLowerFull:
            return [
                DaySkeleton("Upper", .upper, primaries: [hp, hpl, vp, vpl], secondaries: [[hp], [vp], [hpl, vpl]]),
                DaySkeleton("Lower", .lower, primaries: [sq, hh], secondaries: [[sq], [hh]]),
                DaySkeleton("Full", .full, primaries: [], secondaries: [[hpl, hh]]),
            ]
        case .pushPullLegs:
            return pushPullLegs(suffix: "")
        case .upperLowerUpperLower:
            return [
                DaySkeleton("Upper A", .upper, primaries: [hp, hpl], secondaries: [[vp, vpl], [vp, vpl]]),
                DaySkeleton("Lower A", .lower, primaries: [sq], secondaries: [[hh], [sq], [hh]]),
                DaySkeleton("Upper B", .upper, primaries: [vp, vpl], secondaries: [[hp, hpl], [hp, hpl]]),
                DaySkeleton("Lower B", .lower, primaries: [hh], secondaries: [[sq], [hh], [sq]]),
            ]
        case .pushPullHingeSquat:
            return pushPullHingeSquat
        case .pushPullLegsAccessories:
            return pushPullLegs(suffix: "") + [DaySkeleton("Accessories", .accessories, primaries: [])]
        case .upperLowerUpperLowerUpper:
            return [
                DaySkeleton("Upper A", .upper, primaries: [hp, hpl], secondaries: [[vp, vpl]]),
                DaySkeleton("Lower A", .lower, primaries: [sq], secondaries: [[hh], [sq]]),
                DaySkeleton("Upper B", .upper, primaries: [vp, vpl], secondaries: [[hp, hpl]]),
                DaySkeleton("Lower B", .lower, primaries: [hh], secondaries: [[sq], [hh]]),
                DaySkeleton("Upper C", .upperSecondary, primaries: [], secondaries: [[hp, vpl], [vp, hpl]]),
            ]
        case .pushPullHingeSquatAccessories:
            return pushPullHingeSquat + [DaySkeleton("Accessories", .accessories, primaries: [])]
        case .pushPullLegsUpperLower:
            return [
                DaySkeleton("Push", .push, primaries: [hp, vp], secondaries: [[hp], [hp]]),
                DaySkeleton("Pull", .pull, primaries: [hpl, vpl], secondaries: [[vpl], [vpl]]),
                DaySkeleton("Legs", .lower, primaries: [sq], secondaries: [[hh], [hh]]),
                DaySkeleton("Upper", .upperSecondary, primaries: [], secondaries: [[hpl, vp], [hpl, vp]]),
                DaySkeleton("Lower", .lower, primaries: [hh], secondaries: [[sq], [sq]]),
            ]
        case .pushPullHingeSquatUpperLower:
            return [
                DaySkeleton("Push", .push, primaries: [hp], secondaries: [[vp], [hp]]),
                DaySkeleton("Pull", .pull, primaries: [hpl], secondaries: [[vpl], [hpl]]),
                DaySkeleton("Hinge", .hinge, primaries: [hh], secondaries: [[hh]]),
                DaySkeleton("Squat", .squat, primaries: [sq], secondaries: [[sq]]),
                DaySkeleton("Upper", .upper, primaries: [vp, vpl], secondaries: [[hp, hpl]]),
                DaySkeleton("Lower", .lower, primaries: [], secondaries: [[sq, hh]]),
            ]
        case .pushPullLegsPushPullLegs:
            return [
                DaySkeleton("Push A", .push, primaries: [hp], secondaries: [[hp], [vp], [vp]]),
                DaySkeleton("Pull A", .pull, primaries: [hpl], secondaries: [[hpl], [vpl], [vpl]]),
                DaySkeleton("Legs A", .lower, primaries: [sq], secondaries: [[hh], [hh]]),
                DaySkeleton("Push B", .push, primaries: [vp], secondaries: [[hp], [vp], [hp]]),
                DaySkeleton("Pull B", .pull, primaries: [vpl], secondaries: [[hpl], [vpl], [hpl]]),
                DaySkeleton("Legs B", .lower, primaries: [hh], secondaries: [[sq], [sq]]),
            ]
        }
    }

    private static var pushPullHingeSquat: [DaySkeleton] {
        [
            DaySkeleton("Push", .push, primaries: [.horizontalPush, .verticalPush], secondaries: [[.horizontalPush, .verticalPush], [.horizontalPush, .verticalPush]]),
            DaySkeleton("Hinge", .hinge, primaries: [.hipHinge], secondaries: [[.hipHinge], [.hipHinge]]),
            DaySkeleton("Pull", .pull, primaries: [.horizontalPull, .verticalPull], secondaries: [[.horizontalPull, .verticalPull], [.horizontalPull, .verticalPull]]),
            DaySkeleton("Squat", .squat, primaries: [.squat], secondaries: [[.squat], [.squat]]),
        ]
    }

    private static func pushPullLegs(suffix: String) -> [DaySkeleton] {
        [
            DaySkeleton("Push\(suffix)", .push, primaries: [.horizontalPush, .verticalPush], secondaries: [[.horizontalPush, .verticalPush], [.horizontalPush, .verticalPush]]),
            DaySkeleton("Pull\(suffix)", .pull, primaries: [.horizontalPull, .verticalPull], secondaries: [[.horizontalPull, .verticalPull], [.horizontalPull, .verticalPull]]),
            DaySkeleton("Legs\(suffix)", .lower, primaries: [.squat, .hipHinge], secondaries: [[.squat, .hipHinge], [.squat, .hipHinge]]),
        ]
    }

    /// Three days slide a window of four over HPush, VPull, VPush, Squat, HPull, Hinge, two primaries then two
    /// secondaries (observed on P1 and P7). Two days split a push, a pull, and a leg primary per day (P15). Other day
    /// counts deal the six primaries round-robin over the same cycle.
    private static func fullBody(daysPerWeek: Int) -> [DaySkeleton] {
        let cycle: [MovementPattern] = [.horizontalPush, .verticalPull, .verticalPush, .squat, .horizontalPull, .hipHinge]
        let names = ["Workout A", "Workout B", "Workout C", "Workout D", "Workout E", "Workout F"]
        if daysPerWeek == 2 {
            let a: [MovementPattern] = [.horizontalPush, .horizontalPull, .squat]
            let b: [MovementPattern] = [.verticalPush, .verticalPull, .hipHinge]
            return [
                DaySkeleton(names[0], .full, primaries: a, secondaries: [b, a]),
                DaySkeleton(names[1], .full, primaries: b, secondaries: [a, b]),
            ]
        }
        if daysPerWeek == 3 {
            return (0..<3).map { day in
                let window = (0..<4).map { cycle[(2 * day + $0) % 6] }
                let secondaries = Array(window.suffix(2))
                return DaySkeleton(names[day], .full, primaries: Array(window.prefix(2)), secondaries: [secondaries, secondaries])
            }
        }
        let days = max(1, min(daysPerWeek, 6))
        var primaries = Array(repeating: [MovementPattern](), count: days)
        for (index, pattern) in cycle.enumerated() { primaries[index % days].append(pattern) }
        return (0..<days).map { day in
            let others = cycle.filter { !primaries[day].contains($0) }
            return DaySkeleton(names[day], .full, primaries: primaries[day], secondaries: [others, primaries[day]])
        }
    }
}

extension ProgramSplit {
    /// The wizard row title, which also names a generated program by default.
    var title: String {
        switch self {
        case .noPreference: "No preference"
        case .fullBody: "Full Body"
        case .upperLower: "Upper/Lower Split"
        case .pushPull: "Push/Pull Split"
        case .upperLowerFull: "Upper/Lower/Full Body Split"
        case .pushPullLegs: "Push/Pull/Legs Split"
        case .upperLowerUpperLower: "Upper/Lower/Upper/Lower Split"
        case .pushPullHingeSquat: "Push/Pull/Hinge/Squat Split"
        case .pushPullLegsAccessories: "Push/Pull/Legs + Accessories"
        case .upperLowerUpperLowerUpper: "Upper/Lower/Upper/Lower/Upper Split"
        case .pushPullHingeSquatAccessories: "Push/Pull/Hinge/Squat + Accessories"
        case .pushPullLegsUpperLower: "Push/Pull/Legs/Upper/Lower Split"
        case .pushPullHingeSquatUpperLower: "Push/Pull/Hinge/Squat/Upper/Lower Split"
        case .pushPullLegsPushPullLegs: "Push/Pull/Legs/Push/Pull/Legs Split"
        }
    }

    var summary: String {
        switch self {
        case .noPreference: "We'll choose a recommended split for you"
        case .fullBody: "Train your whole body each workout"
        case .upperLower: "Keep upper and lower body training separate"
        case .pushPull: "Train pushing and pulling movements separately"
        case .upperLowerFull: "Alternate upper, lower, and full-body workouts"
        case .pushPullLegs: "Train push, pull, and legs on separate days"
        case .upperLowerUpperLower, .upperLowerUpperLowerUpper: "Alternate upper and lower body workouts"
        case .pushPullHingeSquat: "Separate push, pull, hinge, and squat training"
        case .pushPullLegsAccessories: "Add accessory work to your push, pull, and leg days"
        case .pushPullHingeSquatAccessories: "Add accessory work to push, pull, hinge, and squat days"
        case .pushPullLegsUpperLower: "Combine push, pull, legs, upper, and lower body days"
        case .pushPullHingeSquatUpperLower: "Combine push, pull, hinge, squat, upper, and lower body days"
        case .pushPullLegsPushPullLegs: "Repeat push, pull, and legs twice each week"
        }
    }
}
