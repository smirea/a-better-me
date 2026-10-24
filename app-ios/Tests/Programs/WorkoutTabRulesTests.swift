import Foundation
import Testing
@testable import App

struct WorkoutSectionsLayoutTests {
    @Test func emptyOrBrokenStorageReadsTheDefaultOrder() {
        #expect(WorkoutSectionsLayout(storage: "").visible == [.activeProgram, .library, .yourSections])
        #expect(WorkoutSectionsLayout(storage: "{not json").visible == [.activeProgram, .library, .yourSections])
    }

    @Test func storedOrderAndToggleSurviveARoundTrip() {
        var layout = WorkoutSectionsLayout()
        layout.order = [.yourSections, .library, .activeProgram]
        layout.showsActiveProgram = false
        let read = WorkoutSectionsLayout(storage: layout.storage)
        #expect(read.order == [.yourSections, .library, .activeProgram])
        #expect(read.visible == [.yourSections, .library])
    }

    @Test func unknownAndRepeatedSectionsAreDroppedAndMissingOnesAppended() {
        let read = WorkoutSectionsLayout(storage: #"{"order":["library","custom","library"]}"#)
        #expect(read.order == [.library, .activeProgram, .yourSections])
        #expect(read.showsActiveProgram)
    }
}

struct NewProgramWizardRulesTests {
    @Test func smartGenerationAsksTheGymOnlyWhenThereIsOne() {
        #expect(NewProgramWizardRules.steps(method: .smartGeneration, hasGyms: true) == [
            .splash, .method, .goal, .days, .split, .sessionLength, .repProgression, .muscleFocus, .gym, .keep, .name, .color, .generating,
        ])
        #expect(!NewProgramWizardRules.steps(method: .smartGeneration, hasGyms: false).contains(.gym))
        #expect(NewProgramWizardRules.steps(method: .fromScratch, hasGyms: true) == [.splash, .method, .name, .color])
    }

    @Test func firstRunStartsFromMFsDefaults() {
        let inputs = NewProgramWizardRules.initialInputs(storage: "", experience: .advanced)
        #expect(inputs == GeneratorInputs(goal: .hypertrophy, daysPerWeek: 3, split: .noPreference, sessionLength: .from40To60, repProgression: .noPreference, deload: true, experience: .advanced))
    }

    @Test func lastAnswersComeBackWithTheProfilesExperience() {
        let last = GeneratorInputs(goal: .strength, daysPerWeek: 4, split: .pushPullHingeSquat, sessionLength: .from60To90, repProgression: .linear, muscleFocus: [.biceps: .more, .chest: .less], gymID: UUID(uuidString: "00000000-0000-0000-0000-000000000001"), deload: false, experience: .beginner)
        let inputs = NewProgramWizardRules.initialInputs(storage: NewProgramWizardRules.storage(of: last), experience: .intermediate)
        var expected = last
        expected.experience = .intermediate
        #expect(inputs == expected)
    }

    @Test func changingTheDayCountClampsAndDropsASplitItNoLongerOffers() {
        let start = GeneratorInputs(goal: .both, daysPerWeek: 3, split: .pushPullLegs, sessionLength: .upTo20, repProgression: .constant, deload: true, experience: .intermediate)
        #expect(NewProgramWizardRules.settingDays(4, in: start).split == .noPreference)
        #expect(NewProgramWizardRules.settingDays(9, in: start).daysPerWeek == 6)
        #expect(NewProgramWizardRules.settingDays(1, in: start).daysPerWeek == 2)
        var fullBody = start
        fullBody.split = .fullBody
        #expect(NewProgramWizardRules.settingDays(5, in: fullBody).split == .fullBody)
    }

    @Test func thumbsToggleAndCount() {
        var focus = NewProgramWizardRules.toggling(.more, of: .biceps, in: [:])
        focus = NewProgramWizardRules.toggling(.more, of: .sideDelts, in: focus)
        focus = NewProgramWizardRules.toggling(.less, of: .chest, in: focus)
        #expect(NewProgramWizardRules.focusSummary(focus) == "2 prioritized · 1 deprioritized")
        focus = NewProgramWizardRules.toggling(.more, of: .biceps, in: focus)
        focus = NewProgramWizardRules.toggling(.more, of: .chest, in: focus)
        #expect(focus == [.sideDelts: .more, .chest: .more])
    }

    @Test func noPreferenceNamesTheSplitItResolvesTo() {
        let inputs = GeneratorInputs(goal: .hypertrophy, daysPerWeek: 2, split: .noPreference, sessionLength: .from40To60, repProgression: .noPreference, deload: true, experience: .intermediate)
        #expect(NewProgramWizardRules.defaultName(for: inputs) == "Full Body")
        #expect(NewProgramWizardRules.defaultName(for: NewProgramWizardRules.settingDays(4, in: inputs)) == "Upper/Lower/Upper/Lower Split")
    }

    @Test func aMissingGymFallsBackToTheDefault() {
        var home = GymProfile(name: "Home")
        var club = GymProfile(name: "Club")
        club.isDefault = true
        home.isDefault = false
        #expect(NewProgramWizardRules.gym(home.id, among: [home, club])?.name == "Home")
        #expect(NewProgramWizardRules.gym(UUID(), among: [home, club])?.name == "Club")
        #expect(NewProgramWizardRules.gym(nil, among: []) == nil)
    }

    @Test func noneIsStoredAsBeginnerAndShownBackAsNone() {
        #expect(ExperienceChoice.none.level == .beginner)
        #expect(ExperienceChoice(.beginner, pickedNone: true) == .none)
        #expect(ExperienceChoice(.beginner, pickedNone: false) == .beginner)
        #expect(ExperienceChoice(.advanced, pickedNone: true) == .advanced)
    }

    @Test func fromScratchIsOneEmptyDayInTenCycles() {
        let scratch = NewProgramWizardRules.scratchProgram(name: "Mine", color: .teal)
        #expect(scratch.program.name == "Mine")
        #expect(scratch.program.color == .teal)
        #expect(scratch.program.cycles == 10)
        #expect(scratch.templates.map(\.name) == ["Day 1"])
        #expect(scratch.templates.map(\.programID) == [scratch.program.id])
        #expect(scratch.program.days.map(\.templateID) == [scratch.templates[0].id])
    }
}

struct ShortcutsLayoutTests {
    @Test func defaultsMatchTheReferenceSheet() {
        let layout = ShortcutsLayout()
        #expect(layout.topRow == [.weight, .history])
        #expect(layout.rows == [.emptyWorkout, .newProgram, .newWorkout])
        #expect(layout.hidden == [])
    }

    @Test func pinningARowMovesItToTheTopRow() {
        var layout = ShortcutsLayout()
        layout.top = .newWorkout
        #expect(layout.topRow == [.weight, .newWorkout])
        #expect(layout.rows == [.emptyWorkout, .newProgram])
        #expect(layout.hidden == [.history])
    }

    @Test func hidingAndShowingKeepsOrder() {
        var layout = ShortcutsLayout()
        layout.setVisible(.emptyWorkout, false)
        #expect(layout.rows == [.newProgram, .newWorkout])
        #expect(layout.hidden == [.emptyWorkout])
        layout.setVisible(.emptyWorkout, true)
        #expect(layout.rows == [.newProgram, .newWorkout, .emptyWorkout])
    }
}
