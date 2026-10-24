import Foundation

/// What Smart Generation returns: the program row and one template per workout day, with `programID` set.
struct GeneratedProgram: Hashable {
    var program: Program
    var templates: [WorkoutTemplate]
}

/// One generated exercise before it becomes a `BlockExercise`, kept for the calibration tests.
struct GeneratedSlot: Hashable {
    var exerciseID: ExerciseID
    var role: GeneratedRole
    var pattern: MovementPattern?
    var muscle: Muscle?
    var sets: Int
}

/// Smart Generation (research spec milestone-2.md §1). A pure function over the wizard answers, the profile, the
/// catalog, and the gym: everything but exercise identity is deterministic, and ties between equally ranked exercises
/// break on the random generator passed in, as MF's do.
enum ProgramGenerator {
    static let minutesPerCompoundSet = 3
    static let minutesPerAccessorySet = 2
    /// Weekly secondary slots per pattern grow with days times session minutes. 140 reproduces all 20 calibration programs.
    static let minutesPerWeeklySecondary = 140

    struct Day: Hashable {
        var skeleton: DaySkeleton
        var slots: [GeneratedSlot]
    }

    static func generate(
        _ inputs: GeneratorInputs,
        profile: ProfileSettings,
        catalog: [Exercise],
        equipment: [EquipmentID: Equipment],
        gym: GymProfile?,
        doNotRecommend: Set<ExerciseID> = [],
        name: String? = nil,
        color: ProgramColor = .red,
        icon: String = ProgramColor.defaultIcon,
        using rng: inout some RandomNumberGenerator
    ) -> GeneratedProgram {
        let days = plan(inputs, profile: profile, catalog: catalog, equipment: equipment, gym: gym, doNotRecommend: doNotRecommend, using: &rng)
        let split = SplitPlan.resolve(inputs.split, daysPerWeek: inputs.daysPerWeek)
        // MF's generated programs are weekly, call their cycles weeks, and switch Periodization on (the week cards).
        var config = ProgramConfig()
        config.dayOrder = .weekly
        config.periodization = true
        config.deload = inputs.deload ? .lastCycle : .none
        config.generator = inputs
        var program = Program(name: name ?? split.title, color: color, icon: icon, cycles: RepScheme.cycles, config: config)
        var templates: [WorkoutTemplate] = []
        var workoutDays = days.makeIterator()
        program.days = SplitPlan.weekPattern(daysPerWeek: inputs.daysPerWeek).map { isWorkout in
            guard isWorkout, let day = workoutDays.next() else { return ProgramDay() }
            var template = WorkoutTemplate(name: day.skeleton.name, blocks: day.slots.map { slot in
                let targets = RepScheme.cycleTargets(count: slot.sets, goal: inputs.goal, role: slot.role, progression: inputs.repProgression)
                return WorkoutBlock(exercises: [BlockExercise(exerciseID: slot.exerciseID, sets: targets[0].sets, cycleTargets: targets)])
            })
            template.programID = program.id
            template.gymID = gym?.id
            templates.append(template)
            return ProgramDay(templateID: template.id)
        }
        return GeneratedProgram(program: program, templates: templates)
    }

    /// The skeleton and exercise of every slot of every workout day, before reps and RIR are attached.
    static func plan(
        _ inputs: GeneratorInputs,
        profile: ProfileSettings,
        catalog: [Exercise],
        equipment: [EquipmentID: Equipment],
        gym: GymProfile?,
        doNotRecommend: Set<ExerciseID> = [],
        using rng: inout some RandomNumberGenerator
    ) -> [Day] {
        let split = SplitPlan.resolve(inputs.split, daysPerWeek: inputs.daysPerWeek)
        let skeletons = SplitPlan.skeletons(for: split, daysPerWeek: inputs.daysPerWeek)
        let band = inputs.sessionLength
        let allowance = Volume(goal: inputs.goal, band: band, daysPerWeek: inputs.daysPerWeek, split: split)
        var weeklySecondaries = Dictionary(uniqueKeysWithValues: MovementPattern.allCases.map {
            ($0, inputs.daysPerWeek * band.midMinutes / minutesPerWeeklySecondary)
        })

        var compounds: [[(MovementPattern, SlotRole)]] = skeletons.map { day in day.primaries.map { ($0, SlotRole.primary) } }
        // Tier by tier across the week, so every pattern has one secondary before any has two.
        var closed = Set<Int>()
        for tier in 0..<(skeletons.map(\.secondaryTiers.count).max() ?? 0) {
            for (index, day) in skeletons.enumerated() where !closed.contains(index) {
                guard let patterns = day.secondaryTiers[safe: tier] else { continue }
                let wanted = patterns.filter { weeklySecondaries[$0, default: 0] > 0 }
                guard !wanted.isEmpty else { continue }
                let grown = compounds[index] + wanted.map { ($0, SlotRole.secondary) }
                guard allowance.compoundSets(roles: grown.map(\.1), lowerBody: day.region.isLowerBody).reduce(0, +) <= band.compoundSetCap else {
                    closed.insert(index)
                    continue
                }
                compounds[index] = grown
                for pattern in wanted { weeklySecondaries[pattern, default: 0] -= 1 }
            }
        }
        let compoundSets = zip(compounds, skeletons).map { allowance.compoundSets(roles: $0.map(\.1), lowerBody: $1.region.isLowerBody) }

        let accessoryMuscles = Accessories.plan(
            skeletons: skeletons, focus: inputs.muscleFocus,
            count: { index in
                let compoundMinutes = compoundSets[index].reduce(0, +) * minutesPerCompoundSet
                return allowance.accessoryCount(afterCompoundMinutes: compoundMinutes, region: skeletons[index].region)
            },
            setsFor: { allowance.accessorySets(for: $0) }
        )

        let availability = gym.map { GymAvailability(gym: $0, equipment: equipment) }
        var picker = SlotPicker(goal: inputs.goal, focus: inputs.muscleFocus, profile: profile, catalog: catalog, gym: availability, doNotRecommend: doNotRecommend)
        return skeletons.enumerated().map { index, skeleton in
            var slots: [GeneratedSlot] = []
            for ((pattern, role), sets) in zip(compounds[index], compoundSets[index]) {
                guard let exercise = picker.pickCompound(pattern: pattern, role: role, using: &rng) else { continue }
                slots.append(GeneratedSlot(exerciseID: exercise.id, role: GeneratedRole(pattern: pattern, slot: role), pattern: pattern, muscle: nil, sets: sets))
            }
            for (muscle, sets) in accessoryMuscles[index] {
                guard let exercise = picker.pickAccessory(muscle: muscle, using: &rng) else { continue }
                slots.append(GeneratedSlot(exerciseID: exercise.id, role: .accessory, pattern: nil, muscle: muscle, sets: sets))
            }
            return Day(skeleton: skeleton, slots: slots)
        }
    }
}

extension SessionLength {
    /// The minutes a day of this band aims for, fitted so every calibration day lands inside its band at 3 minutes per
    /// compound set and 2 per accessory set.
    var targetMinutes: Int {
        switch self {
        case .upTo20: 18
        case .from20To40: 27
        case .from40To60: 48
        case .from60To90: 72
        case .from90To120: 105
        case .over120: 132
        }
    }

    var midMinutes: Int {
        switch self {
        case .upTo20: 18
        case .from20To40: 35
        case .from40To60: 50
        case .from60To90: 75
        case .from90To120: 105
        case .over120: 125
        }
    }

    /// The most compound sets one day takes. Secondary tiers that would cross it are left out.
    var compoundSetCap: Int {
        switch self {
        case .upTo20: 4
        case .from20To40: 6
        case .from40To60: 10
        case .from60To90, .from90To120: 20
        case .over120: 22
        }
    }

    var title: String {
        switch self {
        case .upTo20: "Up to 20 minutes"
        case .from20To40: "20 to 40 minutes"
        case .from40To60: "40 to 60 minutes"
        case .from60To90: "60 to 90 minutes"
        case .from90To120: "90 to 120 minutes"
        case .over120: "Over 120 minutes"
        }
    }
}

/// Sets per slot and accessories per day for one program's goal and band (research spec §1.4). Compound sets start at a
/// base, then grow one at a time in day order, primaries first, until the band's budget or each role's cap is reached,
/// so the first compound holds the day's highest count. The observed ranges are wide; these values are the fit the
/// calibration tests measure.
struct Volume {
    let goal: TrainingGoal
    let band: SessionLength
    let daysPerWeek: Int
    let split: ProgramSplit

    private var baseSets: Int { band == .upTo20 ? 1 : 2 }

    private var primaryCap: Int {
        switch band {
        case .upTo20: 2
        case .from20To40: 3
        case .from40To60: 3
        case .from60To90: daysPerWeek <= 3 ? 3 : 4
        case .from90To120, .over120: 4
        }
    }

    private func secondaryCap(lowerBody: Bool) -> Int {
        switch band {
        case .upTo20: 1
        case .from20To40: 2
        case .from40To60: goal == .both || lowerBody ? 3 : 2
        case .from60To90: goal == .strength || (lowerBody && daysPerWeek > 3) ? 4 : 3
        case .from90To120, .over120: 4
        }
    }

    /// The compound sets one day aims for.
    private var compoundBudget: Int {
        switch band {
        case .upTo20: 3
        case .from20To40: 6
        case .from40To60: goal == .strength ? 10 : 9
        case .from60To90: 18
        case .from90To120: 20
        case .over120: 22
        }
    }

    /// Set counts for a day's compound slots, in day order. Primaries grow round-robin to their cap first, then
    /// secondaries, until the budget is spent. A day's only primary gets one more at 40 to 60 and 90 to 120 minutes.
    func compoundSets(roles: [SlotRole], lowerBody: Bool) -> [Int] {
        var sets = Array(repeating: baseSets, count: roles.count)
        var total = sets.reduce(0, +)
        let lone = roles.count { $0 == .primary } == 1 && (band == .from40To60 || band == .from90To120)
        for role in [SlotRole.primary, .secondary] {
            let cap = role == .primary ? primaryCap + (lone ? 1 : 0) : secondaryCap(lowerBody: lowerBody)
            var grew = true
            while total < compoundBudget, grew {
                grew = false
                for index in roles.indices where roles[index] == role && sets[index] < cap && total < compoundBudget {
                    sets[index] += 1
                    total += 1
                    grew = true
                }
            }
        }
        return sets
    }

    func accessorySets(for muscle: Muscle) -> Int {
        let lower = muscle.isLowerBody || muscle == .abs || muscle == .obliques || muscle == .lowerBack
        switch band {
        case .from20To40: return lower ? 2 : 3
        case .from40To60: return goal == .strength ? 2 : (lower && (goal == .both || split != .fullBody) ? 2 : 3)
        case .over120: return lower ? 2 : 3
        default: return 3
        }
    }

    /// Accessories are added while the day is still under its target.
    func accessoryCount(afterCompoundMinutes minutes: Int, region: DayRegion) -> Int {
        let perAccessory = ProgramGenerator.minutesPerAccessorySet * accessorySets(for: region.isLowerBody ? .quads : .chest)
        var total = minutes
        var count = 0
        while total < band.targetMinutes {
            total += perAccessory
            count += 1
        }
        return count
    }
}

/// Which muscle each accessory slot trains. A fixed priority list, filtered by the day's region, dealt round-robin to
/// the days that share a region (observed on the 3x full-body programs). Focus "more" moves a muscle to the front and
/// lets it appear twice; "less" drops it.
enum Accessories {
    static let priority: [Muscle] = [
        .sideDelts, .biceps, .triceps, .chest, .rearDelts, .lats, .calves, .hamstrings, .quads, .upperTraps, .upperBack, .abs,
        .neck, .glutes, .forearms, .abductors, .obliques, .adductors, .frontDelts, .lowerBack,
    ]

    /// A split day's list, in the order MF filled them (P3, P5, P6, P13, P14, P20): the region's big muscles, a second
    /// round of them, then the small ones. Full-body days walk `priority` dealt across the days.
    static func muscles(in region: DayRegion) -> [Muscle] {
        switch region {
        case .full: priority
        case .accessories: [.sideDelts, .biceps, .rearDelts, .lats, .calves, .abs, .calves, .abs, .calves, .neck, .abductors, .obliques, .abductors, .triceps, .chest, .hamstrings, .quads, .forearms]
        case .push: [.sideDelts, .triceps, .chest, .sideDelts, .triceps, .neck, .frontDelts, .chest]
        case .pull: [.biceps, .rearDelts, .lats, .biceps, .upperTraps, .upperBack, .forearms, .rearDelts, .lats, .neck]
        case .upper: [.sideDelts, .biceps, .triceps, .chest, .rearDelts, .lats, .biceps, .chest, .sideDelts, .triceps, .rearDelts, .lats, .upperTraps, .upperBack, .forearms, .neck, .frontDelts]
        case .upperSecondary: [.triceps, .rearDelts, .sideDelts, .upperTraps, .forearms, .neck, .biceps, .chest, .lats, .frontDelts, .upperBack]
        case .lower: [.calves, .hamstrings, .quads, .abs, .abductors, .obliques, .hamstrings, .glutes, .adductors, .calves, .glutes, .lowerBack]
        case .hinge: [.hamstrings, .hamstrings, .obliques, .lowerBack, .hamstrings, .glutes, .adductors]
        case .squat: [.quads, .glutes, .adductors, .glutes, .abductors, .quads]
        }
    }

    static func list(for region: DayRegion, focus: [Muscle: Emphasis]) -> [Muscle] {
        var list = muscles(in: region).filter { focus[$0] != .less }
        let more = list.filter { focus[$0] == .more }
        guard !more.isEmpty else { return list }
        list.removeAll { focus[$0] == .more }
        let repeatAt = min(list.count, 3)
        return more + Array(list.prefix(repeatAt)) + more + Array(list.dropFirst(repeatAt))
    }

    /// One `(muscle, sets)` list per day. `count` says how many accessories day `index` takes.
    static func plan(skeletons: [DaySkeleton], focus: [Muscle: Emphasis], count: (Int) -> Int, setsFor: (Muscle) -> Int) -> [[(Muscle, Int)]] {
        var position: [DayRegion: Int] = [:]
        var shareCount: [DayRegion: Int] = [:]
        for day in skeletons { shareCount[day.region, default: 0] += 1 }
        return skeletons.enumerated().map { index, day in
            let list = list(for: day.region, focus: focus)
            guard !list.isEmpty else { return [] }
            let offset = position[day.region, default: 0]
            position[day.region, default: 0] += 1
            let stride = shareCount[day.region, default: 1]
            return (0..<count(index)).map { slot in
                let muscle = list[(slot * stride + offset) % list.count]
                return (muscle, setsFor(muscle))
            }
        }
    }
}

/// Picks one exercise per slot: the lowest recommendation level for the goal and slot among exercises the gym can
/// equip, the assessment allows, the owner has not excluded, and nothing already in the program conflicts with. Ties
/// break at random, as MF's do (research spec §1.7).
struct SlotPicker {
    let goal: TrainingGoal
    let focus: [Muscle: Emphasis]
    let profile: ProfileSettings
    let catalog: [Exercise]
    let gym: GymAvailability?
    let doNotRecommend: Set<ExerciseID>
    private(set) var used: Set<ExerciseID> = []
    private(set) var usedGroupings: Set<String> = []

    init(goal: TrainingGoal, focus: [Muscle: Emphasis], profile: ProfileSettings, catalog: [Exercise], gym: GymAvailability?, doNotRecommend: Set<ExerciseID>) {
        self.goal = goal
        self.focus = focus
        self.profile = profile
        self.catalog = catalog
        self.gym = gym
        self.doNotRecommend = doNotRecommend
    }

    mutating func pickCompound(pattern: MovementPattern, role: SlotRole, using rng: inout some RandomNumberGenerator) -> Exercise? {
        let pool = catalog.filter { $0.movementPatterns.first == pattern.rawValue && $0.level(goal: goal, slot: role) != nil }
        return pick(from: pool, slot: role, prefer: focused(pool), using: &rng)
    }

    mutating func pickAccessory(muscle: Muscle, using rng: inout some RandomNumberGenerator) -> Exercise? {
        let pool = catalog.filter { $0.primaryMuscles.contains(muscle) && $0.level(goal: goal, slot: .accessory) != nil }
        let exact = pool.filter { $0.primaryMuscles.first == muscle }
        return pick(from: pool, slot: .accessory, prefer: exact.isEmpty ? pool : exact, using: &rng)
    }

    /// Focus bias for compounds: "more" keeps exercises that make the muscle a primary or emphasized agonist, "less"
    /// drops those with it as a primary, when either leaves something to choose from.
    private func focused(_ pool: [Exercise]) -> [Exercise] {
        var preferred = pool
        let more = focus.filter { $0.value == .more }.map(\.key)
        if !more.isEmpty {
            let hits = preferred.filter { exercise in more.contains { exercise.primaryMuscles.contains($0) || exercise.selection?.emphasizedAgonists.contains($0) == true } }
            if !hits.isEmpty { preferred = hits }
        }
        let less = focus.filter { $0.value == .less }.map(\.key)
        if !less.isEmpty {
            let spared = preferred.filter { exercise in !less.contains { exercise.primaryMuscles.contains($0) } }
            if !spared.isEmpty { preferred = spared }
        }
        return preferred
    }

    private mutating func pick(from pool: [Exercise], slot: SlotRole, prefer preferred: [Exercise], using rng: inout some RandomNumberGenerator) -> Exercise? {
        let strict = { (exercise: Exercise) -> Bool in
            !self.used.contains(exercise.id)
                && !self.doNotRecommend.contains(exercise.id)
                && ExerciseAssessment.allows(exercise, profile: self.profile)
                && (self.gym?.isAvailable(exercise) ?? true)
                && exercise.selection.map { $0.exclusionGroupings.allSatisfy { !self.usedGroupings.contains($0) } } ?? true
        }
        let withoutGrouping = { (exercise: Exercise) -> Bool in
            !self.used.contains(exercise.id) && !self.doNotRecommend.contains(exercise.id)
                && ExerciseAssessment.allows(exercise, profile: self.profile) && (self.gym?.isAvailable(exercise) ?? true)
        }
        let candidates = [preferred.filter(strict), pool.filter(strict), pool.filter(withoutGrouping)].first { !$0.isEmpty } ?? []
        guard let best = candidates.compactMap({ $0.level(goal: goal, slot: slot) }).min() else { return nil }
        let tied = candidates.filter { $0.level(goal: goal, slot: slot) == best }
        guard let choice = tied.randomElement(using: &rng) else { return nil }
        used.insert(choice.id)
        usedGroupings.formUnion(choice.selection?.exclusionGroupings ?? [])
        return choice
    }
}

extension Exercise {
    /// The recommendation level for a goal and slot, lower is better. "Both" reads strength for primaries and
    /// hypertrophy otherwise. `nil` means the exercise never fills that slot.
    func level(goal: TrainingGoal, slot: SlotRole) -> Double? {
        guard let selection else { return nil }
        let levels = switch goal {
        case .strength: selection.strength
        case .hypertrophy: selection.hypertrophy
        case .both: slot == .primary ? selection.strength : selection.hypertrophy
        }
        return switch slot {
        case .primary: levels.primaryCompound
        case .secondary: levels.secondaryCompound
        case .accessory: levels.accessory
        }
    }
}
