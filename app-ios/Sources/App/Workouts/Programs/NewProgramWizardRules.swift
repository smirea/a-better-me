import Foundation

/// The New Program wizard's screens (research spec milestone-2.md §1.1). The editor that follows is a separate route.
enum WizardStep: Hashable {
    case splash, method, goal, days, split, sessionLength, repProgression, muscleFocus, gym, keep, name, color, generating
}

enum CreationMethod: Hashable {
    case smartGeneration, fromScratch, importFile
}

/// The Lifting Experience sheet's four rows. `ProfileSettings` has no "not lifting" level, so None is stored as
/// beginner and the wizard remembers that the owner picked None.
enum ExperienceChoice: String, CaseIterable, Identifiable {
    case none, beginner, intermediate, advanced

    var id: String { rawValue }

    var level: LiftingExperience {
        switch self {
        case .none, .beginner: .beginner
        case .intermediate: .intermediate
        case .advanced: .advanced
        }
    }

    /// The row the sheet selects: None only while the profile still holds the beginner level None wrote.
    init(_ level: LiftingExperience, pickedNone: Bool) {
        self = switch level {
        case .beginner: pickedNone ? .none : .beginner
        case .intermediate: .intermediate
        case .advanced: .advanced
        }
    }
}

enum NewProgramWizardRules {
    static let storageKey = "newProgramWizard.lastInputs"
    static let pickedNoneKey = "newProgramWizard.pickedNoExperience"
    static let dayRange = 2...6
    static let upperFocus: [Muscle] = [.biceps, .triceps, .sideDelts, .chest, .lats, .rearDelts, .abs, .frontDelts, .upperBack, .obliques, .upperTraps, .lowerBack, .forearms]
    static let lowerFocus: [Muscle] = [.quads, .glutes, .hamstrings, .calves, .adductors, .abductors]

    /// The screens a method walks through. The gym question is skipped when there is no gym to choose.
    static func steps(method: CreationMethod, hasGyms: Bool) -> [WizardStep] {
        switch method {
        case .smartGeneration:
            [.splash, .method, .goal, .days, .split, .sessionLength, .repProgression, .muscleFocus]
                + (hasGyms ? [.gym] : []) + [.keep, .name, .color, .generating]
        case .fromScratch:
            [.splash, .method, .name, .color]
        case .importFile:
            [.splash, .method]
        }
    }

    /// The answers the wizard opens with: the last generation's, read back from `storageKey`, or MF's defaults. The
    /// stored split is dropped when the day count no longer offers it, and the experience is always the profile's.
    static func initialInputs(storage: String, experience: LiftingExperience) -> GeneratorInputs {
        let fallback = GeneratorInputs(goal: .hypertrophy, daysPerWeek: 3, split: .noPreference, sessionLength: .from40To60, repProgression: .noPreference, deload: true, experience: experience)
        guard var inputs = try? JSONDecoder().decode(GeneratorInputs.self, from: Data(storage.utf8)) else { return fallback }
        inputs.experience = experience
        return settingDays(inputs.daysPerWeek, in: inputs)
    }

    static func storage(of inputs: GeneratorInputs) -> String {
        (try? JSONEncoder().encode(inputs)).map { String(decoding: $0, as: UTF8.self) } ?? ""
    }

    /// The − / + stepper. A split the new day count does not offer falls back to No preference.
    static func settingDays(_ days: Int, in inputs: GeneratorInputs) -> GeneratorInputs {
        var inputs = inputs
        inputs.daysPerWeek = min(max(days, dayRange.lowerBound), dayRange.upperBound)
        if !SplitPlan.options(daysPerWeek: inputs.daysPerWeek).contains(inputs.split) { inputs.split = .noPreference }
        return inputs
    }

    /// Tapping a thumb: the same emphasis again clears the muscle, the other one replaces it.
    static func toggling(_ emphasis: Emphasis, of muscle: Muscle, in focus: [Muscle: Emphasis]) -> [Muscle: Emphasis] {
        var focus = focus
        focus[muscle] = focus[muscle] == emphasis ? nil : emphasis
        return focus
    }

    /// "2 prioritized · 1 deprioritized"
    static func focusSummary(_ focus: [Muscle: Emphasis]) -> String {
        let more = focus.values.filter { $0 == .more }.count
        return "\(more) prioritized · \(focus.count - more) deprioritized"
    }

    /// The gym the program is generated for: the remembered one while it still exists, else the default gym.
    static func gym(_ id: UUID?, among gyms: [GymProfile]) -> GymProfile? {
        gyms.first { $0.id == id } ?? gyms.first(where: \.isDefault) ?? gyms.first
    }

    /// The name step's prefill: the split the generator will build, so No preference names the resolved split.
    static func defaultName(for inputs: GeneratorInputs) -> String {
        SplitPlan.resolve(inputs.split, daysPerWeek: inputs.daysPerWeek).title
    }

    /// Build From Scratch: one empty workout day named "Day 1" in a ten-cycle program.
    static func scratchProgram(name: String, color: ProgramColor) -> GeneratedProgram {
        var program = Program(name: name, color: color, cycles: 10)
        var template = WorkoutTemplate(name: "Day 1")
        template.programID = program.id
        program.days = [ProgramDay(templateID: template.id)]
        return GeneratedProgram(program: program, templates: [template])
    }
}
