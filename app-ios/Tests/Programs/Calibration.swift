import Foundation
@testable import App

/// SplitMix64: a seeded generator so a test's exercise picks repeat.
struct SeededGenerator: RandomNumberGenerator {
    var state: UInt64

    init(seed: UInt64) { state = seed }

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}

/// The 20 programs MF generated for the research thread, `docs/research/mf-workouts/generated-programs.json`.
struct MFProgram: Decodable {
    let export: String
    let inputs: MFInputs
    let output: MFOutput

    /// "P1", "P13".
    var id: String { String(output.name.split(separator: " ")[1]) }
}

struct MFInputs: Decodable {
    let goal: String
    let daysPerWeek: Int
    let split: String
    let sessionMinutes: String
    let repProgression: String
    let muscleFocus: [String: String]
    let deload: Bool
    let experience: String
}

struct MFOutput: Decodable {
    let name: String
    let cycles: Int
    let deload: String?
    let days: [MFDay]
}

struct MFDay: Decodable {
    let name: String?
    let rest: Bool?
    let exercises: [MFExercise]?

    var isRest: Bool { rest == true }
}

struct MFExercise: Decodable {
    let id: String
    let name: String
    let primary: [String]
    let secondary: [String]
    let movementPattern: [String]
    let classification: [String: [String]]
    let setsPerCycle: [[MFSet]]
}

struct MFSet: Decodable {
    let repsMin: Int
    let repsMax: Int
    let rir: Int
}

/// What one MF pick was, read back from its cycle 1 sets the way `tools/programs-analysis.py` does: the RIR track
/// separates push and leg compounds, pull compounds, and accessories, and the rep tier separates primary from secondary.
struct MFSlot: Hashable {
    enum Role: Hashable { case primary, secondary, pullEither, pullPrimary, pullSecondary, accessory }

    var role: Role
    var pattern: MovementPattern?
    var muscles: [Muscle]
    var sets: Int
    var tiers: [Int]
    var rirs: [[Int]]
}

enum Calibration {
    static let root: URL = {
        var url = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { url.deleteLastPathComponent() }
        return url
    }()

    static let fixture = root.appending(path: "docs/research/mf-workouts/generated-programs.json")

    /// The fixture lands with the research PR; until it is on the branch the calibration suite is skipped, not passed.
    static var isAvailable: Bool { FileManager.default.fileExists(atPath: fixture.path) }

    static let programs: [MFProgram] = {
        struct File: Decodable { let programs: [MFProgram] }
        guard let data = try? Data(contentsOf: fixture) else { fatalError("Missing \(fixture.path). Fetch it from the m2-research branch.") }
        return try! JSONDecoder().decode(File.self, from: data).programs
    }()

    /// The owner's assessment as the research inferred it: barbell presses yes, pull-ups and dips no.
    static let profile: ProfileSettings = {
        var profile = ProfileSettings()
        profile.assessment = ["benchPress10": "yes", "inclinePress10": "yes", "overheadPress10": "yes", "pushUps15": "yes", "pullUps5": "no", "pullUps10": "no", "dips10": "no"]
        return profile
    }()

    static func inputs(_ mf: MFInputs) -> GeneratorInputs {
        let band: SessionLength = switch mf.sessionMinutes {
        case "0-20": .upTo20
        case "20-40": .from20To40
        case "40-60": .from40To60
        case "60-90": .from60To90
        case "90-120": .from90To120
        default: .over120
        }
        var focus: [Muscle: Emphasis] = [:]
        for (key, value) in mf.muscleFocus {
            focus[muscle(camel: key)] = Emphasis(rawValue: value)!
        }
        return GeneratorInputs(
            goal: TrainingGoal(rawValue: mf.goal)!,
            daysPerWeek: mf.daysPerWeek,
            split: ProgramSplit(rawValue: mf.split)!,
            sessionLength: band,
            repProgression: RepProgression(rawValue: mf.repProgression) ?? .noPreference,
            muscleFocus: focus,
            deload: mf.deload,
            experience: LiftingExperience(rawValue: mf.experience)!
        )
    }

    /// "sideDelts" to `.sideDelts`.
    static func muscle(camel: String) -> Muscle {
        var snake = ""
        for character in camel {
            if character.isUppercase { snake += "_" }
            snake += character.lowercased()
        }
        return Muscle(rawValue: snake)!
    }

    /// "Side Delts" or "Hip flexors" to the muscle.
    static func muscle(named name: String) -> Muscle? {
        Muscle.allCases.first { $0.displayName.caseInsensitiveCompare(name) == .orderedSame }
    }

    /// The owner's "Aquasol 6770" gym from `equipment.md`: every catalog item except those the list marks absent.
    /// Items the list never mentions count as present, as MF's picks imply.
    static func gym(_ equipment: [String: Equipment]) -> GymProfile {
        let text = try! String(contentsOf: root.appending(path: "docs/research/mf-workouts/equipment.md"), encoding: .utf8)
        var absent: Set<String> = []
        for line in text.split(separator: "\n") where line.hasPrefix("- ") && line.contains("(not in this gym)") {
            let name = line.dropFirst(2).split(separator: " — ")[0]
            absent.insert(name.lowercased())
        }
        var selected: [EquipmentID: GymEquipment] = [:]
        for item in equipment.values where !absent.contains(item.name.lowercased()) {
            selected[item.id] = GymEquipment()
        }
        return GymProfile(name: "Aquasol 6770", equipment: selected)
    }

    static func slots(of program: MFProgram) -> [[MFSlot]] {
        let days = program.output.days.filter { !$0.isRest }
        var raw: [[(track: Character, low: Int, exercise: MFExercise)]] = days.map { day in
            (day.exercises ?? []).map { exercise in
                let rirs = exercise.setsPerCycle[0].map(\.rir)
                return (track(rirs), exercise.setsPerCycle[0][0].repsMin, exercise)
            }
        }
        let lows: [Character: [Int]] = ["A", "B"].reduce(into: [:]) { result, track in
            result[track] = Array(Set(raw.flatMap { $0 }.filter { $0.track == track }.map(\.low))).sorted()
        }
        return raw.indices.map { dayIndex in
            raw[dayIndex].map { entry in
                let exercise = entry.exercise
                let role: MFSlot.Role
                if entry.track == "C" {
                    role = .accessory
                } else if entry.track == "B", lows["B"]?.count == 1 {
                    role = .pullEither
                } else {
                    let isPrimary = entry.low == lows[entry.track]?.first
                    role = entry.track == "B" ? (isPrimary ? .pullPrimary : .pullSecondary) : (isPrimary ? .primary : .secondary)
                }
                return MFSlot(
                    role: role,
                    pattern: role == .accessory ? nil : MovementPattern(rawValue: exercise.movementPattern[0]),
                    muscles: exercise.primary.compactMap(muscle(named:)),
                    sets: exercise.setsPerCycle[0].count,
                    tiers: exercise.setsPerCycle.map { $0[0].repsMin },
                    rirs: exercise.setsPerCycle.map { $0.map(\.rir) }
                )
            }
        }
    }

    private static func track(_ rirs: [Int]) -> Character {
        if rirs.count == 1 { return [2: "A", 1: "B", 0: "C"][rirs[0]] ?? "C" }
        if rirs.last == 1 { return "A" }
        return rirs[rirs.count - 2] == 0 ? "C" : "B"
    }

    /// Weighted weekly sets per muscle: a primary counts 1 per set, a secondary 0.5.
    static func weeklySets(_ program: MFProgram) -> [Muscle: Double] {
        var sets: [Muscle: Double] = [:]
        for day in program.output.days where !day.isRest {
            for exercise in day.exercises ?? [] {
                let count = Double(exercise.setsPerCycle[0].count)
                for name in exercise.primary { if let m = muscle(named: name) { sets[m, default: 0] += count } }
                for name in exercise.secondary { if let m = muscle(named: name) { sets[m, default: 0] += count / 2 } }
            }
        }
        return sets
    }

    static func weeklySets(_ days: [ProgramGenerator.Day], catalog: [ExerciseID: Exercise]) -> [Muscle: Double] {
        var sets: [Muscle: Double] = [:]
        for slot in days.flatMap(\.slots) {
            guard let exercise = catalog[slot.exerciseID] else { continue }
            for m in exercise.primaryMuscles { sets[m, default: 0] += Double(slot.sets) }
            for m in exercise.secondaryMuscles { sets[m, default: 0] += Double(slot.sets) / 2 }
        }
        return sets
    }
}

/// The generator's distance from one MF program, in the units the research compares (milestone-2.md §1.2 to §1.8).
struct CalibrationError: CustomStringConvertible {
    var id = ""
    var label = ""
    /// Compound slots that differ per day, summed: a `(pattern, role)` MF has and we lack or the reverse.
    var slotMismatches = 0
    /// Sum over days of the absolute difference in compound sets.
    var compoundSetError = 0
    /// Sum over days of the absolute difference in accessory exercise counts.
    var accessoryCountError = 0
    /// Sum over days of the absolute difference in accessory sets.
    var accessorySetError = 0
    /// Accessory muscles per day that differ, summed over days (multiset difference).
    var accessoryMuscleMismatches = 0
    /// Generated exercises whose seven-cycle rep tiers differ from MF's for the same role.
    var repMismatches = 0
    /// Generated exercises whose RIR per set differs from MF's for the same role and set count.
    var rirMismatches = 0
    /// Sum over muscles of the absolute weekly-set difference, and the largest single muscle difference.
    var muscleSetError = 0.0
    var muscleSetMax = 0.0
    var structureMatches = true
    /// One line per day: ours against MF's, for `scripts/calibrate-generator --days`.
    var days: [String] = []

    var description: String {
        String(
            format: "%@ %@ struct=%@ slots=%d Ksets=%d accN=%d accSets=%d accMuscle=%d reps=%d rir=%d muscleSets=%.1f max=%.1f",
            id, label, structureMatches ? "ok" : "MISMATCH", slotMismatches, compoundSetError, accessoryCountError, accessorySetError,
            accessoryMuscleMismatches, repMismatches, rirMismatches, muscleSetError, muscleSetMax
        )
    }
}

extension Calibration {
    /// Generates a program for `mf`'s inputs and measures the distance.
    @MainActor
    static func measure(_ mf: MFProgram, catalog: ExerciseCatalog, gym: GymProfile, seed: UInt64 = 1) -> (CalibrationError, GeneratedProgram, [ProgramGenerator.Day]) {
        var rng = SeededGenerator(seed: seed)
        let inputs = inputs(mf.inputs)
        let days = ProgramGenerator.plan(inputs, profile: profile, catalog: catalog.bundled, equipment: catalog.equipment, gym: gym, using: &rng)
        var rng2 = SeededGenerator(seed: seed)
        let generated = ProgramGenerator.generate(inputs, profile: profile, catalog: catalog.bundled, equipment: catalog.equipment, gym: gym, using: &rng2)
        var error = CalibrationError()
        error.id = mf.id
        error.label = "\(mf.inputs.goal) \(mf.inputs.daysPerWeek)x \(mf.inputs.split) \(mf.inputs.sessionMinutes) \(mf.inputs.repProgression)"

        let mfPattern = mf.output.days.map { $0.isRest ? "R" : "W" }.joined()
        let ourPattern = generated.program.days.map { $0.templateID == nil ? "R" : "W" }.joined()
        let mfNames = mf.output.days.filter { !$0.isRest }.compactMap(\.name)
        let ourNames = days.map(\.skeleton.name)
        error.structureMatches = mfPattern == ourPattern && mfNames == ourNames && generated.program.cycles == mf.output.cycles
            && (generated.program.config.deload == .lastCycle) == (mf.output.deload == "Last Cycle")

        let mfSlots = slots(of: mf)
        let byID = Dictionary(uniqueKeysWithValues: catalog.bundled.map { ($0.id, $0) })
        for (dayIndex, day) in days.enumerated() {
            let theirs = mfSlots[safe: dayIndex] ?? []
            let theirCompounds = theirs.filter { $0.role != .accessory }
            let ourCompounds = day.slots.filter { !$0.role.isAccessory }
            error.slotMismatches += slotDifference(ours: ourCompounds, theirs: theirCompounds)
            error.compoundSetError += abs(ourCompounds.reduce(0) { $0 + $1.sets } - theirCompounds.reduce(0) { $0 + $1.sets })
            let theirAccessories = theirs.filter { $0.role == .accessory }
            let ourAccessories = day.slots.filter(\.role.isAccessory)
            error.accessoryCountError += abs(ourAccessories.count - theirAccessories.count)
            error.accessorySetError += abs(ourAccessories.reduce(0) { $0 + $1.sets } - theirAccessories.reduce(0) { $0 + $1.sets })
            error.accessoryMuscleMismatches += multisetDifference(ourAccessories.compactMap(\.muscle), theirAccessories.compactMap(\.muscles.first))
            let ourLine = ourCompounds.map { "\(short($0.pattern!))\($0.role.isPrimary ? "P" : "S")\($0.sets)" } + ourAccessories.map { "\($0.muscle!.rawValue)\($0.sets)" }
            let theirLine = theirCompounds.map { "\(short($0.pattern!))\($0.role == .primary || $0.role == .pullPrimary ? "P" : $0.role == .pullEither ? "?" : "S")\($0.sets)" } + theirAccessories.map { "\($0.muscles.first?.rawValue ?? "?")\($0.sets)" }
            error.days.append("\(mf.id) \(day.skeleton.name): ours \(ourLine.joined(separator: " ")) | MF \(theirLine.joined(separator: " "))")

            for slot in day.slots {
                let tiers = RepScheme.tiers(goal: inputs.goal, role: slot.role, progression: inputs.repProgression).map(\.min)
                let theirTiers = theirs.first { matches($0, slot) }?.tiers
                if let theirTiers, Array(theirTiers.prefix(tiers.count)) != Array(tiers.prefix(theirTiers.count)) { error.repMismatches += 1 }
                let rirs = RepScheme.rir(role: slot.role, sets: slot.sets)
                if let theirRIR = theirs.first(where: { matches($0, slot) && $0.sets == slot.sets })?.rirs[0], theirRIR != rirs { error.rirMismatches += 1 }
            }
        }
        let ours = weeklySets(days, catalog: byID)
        let theirs = weeklySets(mf)
        for muscle in Set(ours.keys).union(theirs.keys) {
            let delta = abs((ours[muscle] ?? 0) - (theirs[muscle] ?? 0))
            error.muscleSetError += delta
            error.muscleSetMax = max(error.muscleSetMax, delta)
        }
        return (error, generated, days)
    }

    private static func short(_ pattern: MovementPattern) -> String {
        switch pattern {
        case .horizontalPush: "HPush"
        case .verticalPush: "VPush"
        case .horizontalPull: "HPull"
        case .verticalPull: "VPull"
        case .squat: "Squat"
        case .hipHinge: "Hinge"
        }
    }

    private static func matches(_ theirs: MFSlot, _ ours: GeneratedSlot) -> Bool {
        switch (theirs.role, ours.role) {
        case (.accessory, .accessory): true
        case (.primary, .primary), (.secondary, .secondary), (.pullPrimary, .pullPrimary), (.pullSecondary, .pullSecondary): true
        case (.pullEither, .pullPrimary), (.pullEither, .pullSecondary): true
        default: false
        }
    }

    /// Multiset difference of `(pattern, role)`, with MF's tied pulls matching either pull role.
    private static func slotDifference(ours: [GeneratedSlot], theirs: [MFSlot]) -> Int {
        var remaining = theirs
        var missing = 0
        for slot in ours {
            if let index = remaining.firstIndex(where: { $0.pattern == slot.pattern && matches($0, slot) }) {
                remaining.remove(at: index)
            } else {
                missing += 1
            }
        }
        return missing + remaining.count
    }

    private static func multisetDifference<T: Hashable>(_ a: [T], _ b: [T]) -> Int {
        var counts: [T: Int] = [:]
        for x in a { counts[x, default: 0] += 1 }
        for x in b { counts[x, default: 0] -= 1 }
        return counts.values.reduce(0) { $0 + abs($1) }
    }
}
