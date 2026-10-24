import Foundation
import Testing
@testable import App

struct WorkoutSectionsLayoutTests {
    private static let sectionA = UUID(uuidString: "00000000-0000-0000-0000-00000000000A")!
    private static let sectionB = UUID(uuidString: "00000000-0000-0000-0000-00000000000B")!
    private static let push = UUID(uuidString: "00000000-0000-0000-0000-000000000001")!
    private static let pull = UUID(uuidString: "00000000-0000-0000-0000-000000000002")!

    private static func twoSections() -> WorkoutSectionsLayout {
        var layout = WorkoutSectionsLayout()
        layout.custom = [
            CustomWorkoutSection(id: sectionA, name: "Travel", templateIDs: [push]),
            CustomWorkoutSection(id: sectionB, name: "Home", templateIDs: [pull]),
        ]
        return layout
    }

    @Test func unknownAndRepeatedSectionsAreDroppedAndMissingOnesAppended() {
        #expect(WorkoutSectionsLayout.normalized(["library", "custom", "library"]) == [.library, .activeProgram, .yourSections])
        #expect(WorkoutSectionsLayout.normalized([]) == [.activeProgram, .library, .yourSections])
        #expect(WorkoutSectionsLayout.normalized(["yourSections", "activeProgram", "library"]) == [.yourSections, .activeProgram, .library])
    }

    @Test func decodingNormalizesTheOrderAndKeepsTheCustomSections() throws {
        let json = #"{"order":["yourSections","bogus","yourSections"],"showsActiveProgram":false,"custom":[{"id":"00000000-0000-0000-0000-00000000000A","name":"Travel","templateIDs":["00000000-0000-0000-0000-000000000001"],"collapsed":true}]}"#
        let read = try JSONDecoder().decode(WorkoutSectionsLayout.self, from: Data(json.utf8))
        #expect(read.order == [.yourSections, .activeProgram, .library])
        #expect(read.visible == [.yourSections, .library])
        #expect(read.custom == [CustomWorkoutSection(id: Self.sectionA, name: "Travel", templateIDs: [Self.push], collapsed: true)])
    }

    @Test func filingAWorkoutMovesItOutOfItsOtherSection() {
        var layout = Self.twoSections()
        layout.file(Self.push, in: Self.sectionB, true)
        #expect(layout.custom.map(\.templateIDs) == [[], [Self.pull, Self.push]])
        layout.file(Self.pull, in: Self.sectionB, false)
        #expect(layout.custom.map(\.templateIDs) == [[], [Self.push]])
    }

    @Test func deletingASectionReturnsItsWorkoutsToTheLibrary() {
        var layout = Self.twoSections()
        #expect(layout.filedTemplateIDs == [Self.push, Self.pull])
        layout.deleteSection(Self.sectionA)
        #expect(layout.custom.map(\.name) == ["Home"])
        #expect(layout.filedTemplateIDs == [Self.pull])
    }

    @Test func namesAreTrimmedOnAddAndRename() {
        var layout = WorkoutSectionsLayout()
        let id = layout.addSection(named: "  Deload Week ")
        #expect(layout.custom.map(\.name) == ["Deload Week"])
        layout.rename(id, to: " Travel\n")
        #expect(layout.custom.map(\.name) == ["Travel"])
    }
}

struct NewProgramWizardRulesTests {
    @Test func smartGenerationAsksTheGymOnlyWhenThereIsOne() {
        #expect(NewProgramWizardRules.steps(method: .smartGeneration, hasGyms: true) == [
            .splash, .method, .goal, .days, .split, .sessionLength, .repProgression, .muscleFocus, .gym, .keep, .name, .color, .generating,
        ])
        #expect(!NewProgramWizardRules.steps(method: .smartGeneration, hasGyms: false).contains(.gym))
        #expect(NewProgramWizardRules.steps(method: .fromScratch, hasGyms: true) == [.splash, .method, .name, .color])
        #expect(NewProgramWizardRules.steps(method: .importFile, hasGyms: true) == [.splash, .method])
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
        let scratch = NewProgramWizardRules.scratchProgram(name: "Mine", color: .teal, icon: "flame.fill")
        #expect(scratch.program.name == "Mine")
        #expect(scratch.program.color == .teal)
        #expect(scratch.program.icon == "flame.fill")
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

struct WeekStripProgramTests {
    private static let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        calendar.firstWeekday = 2
        return calendar
    }()

    private static func date(_ day: Int, hour: Int = 12) -> Date {
        calendar.date(from: DateComponents(year: 2026, month: 10, day: day, hour: hour))!
    }

    /// Workout A, rest, B, rest, C, rest, rest; the run started on Friday, October 23, 2026.
    private static func weekly() -> Program {
        let days = [UUID(), nil, UUID(), nil, UUID(), nil, nil].map { ProgramDay(templateID: $0) }
        var program = Program(name: "P1", color: .red, cycles: 7, days: days)
        program.config.runStartedAt = date(23, hour: 18)
        return program
    }

    private static func finished(_ program: Program, day: Int, cycle: Int) -> WorkoutSession {
        var session = WorkoutSession(name: "Day \(day + 1)")
        session.program = ProgramPosition(programID: program.id, dayID: program.days[day].id, cycle: cycle)
        session.startedAt = date(24)
        session.endedAt = date(24, hour: 13)
        return session
    }

    @Test func weekdaysCountFromTheDayTheRunStarted() {
        let program = Self.weekly()
        let index = { (day: Int) in program.weekdayDay(on: Self.date(day), calendar: Self.calendar).flatMap { day in program.days.firstIndex(of: day) } }
        #expect(index(23) == 0)
        #expect(index(26) == 3)
        #expect(index(22) == 6)
        #expect(index(30) == 0)
    }

    @Test func withoutARunTheCreationDateIsDayOneAndOtherLengthsHaveNoWeekday() {
        var program = Self.weekly()
        program.config.runStartedAt = nil
        program.createdAt = Self.date(21)
        #expect(program.weekdayDay(on: Self.date(23), calendar: Self.calendar) == program.days[2])
        let rolling = Program(name: "Rolling", color: .blue, cycles: 4, days: [ProgramDay(templateID: UUID()), ProgramDay()])
        #expect(rolling.weekdayDay(on: Self.date(23), calendar: Self.calendar) == nil)
    }

    @Test func progressCountsWorkoutDaysOfTheCurrentCycle() {
        let program = Self.weekly()
        #expect(program.cycleProgress(finished: []) == 0)
        #expect(program.cycleProgress(finished: [Self.finished(program, day: 0, cycle: 1)]) == 1.0 / 3.0)
        #expect(program.cycleProgress(finished: [Self.finished(program, day: 0, cycle: 1), Self.finished(program, day: 2, cycle: 1)]) == 2.0 / 3.0)
        #expect(program.cycleProgress(finished: [Self.finished(program, day: 0, cycle: 2)]) == 0)
        let restOnly = Program(name: "Rest", color: .blue, cycles: 1, days: [ProgramDay()])
        #expect(restOnly.cycleProgress(finished: []) == 0)
    }

    @Test func unloggedDaysFromTodayToSundayOpenTheirProgramDay() {
        let program = Self.weekly()
        let now = Self.date(27, hour: 9)
        let target = { (month: Int, day: Int) in
            DayPillTarget.of(Self.calendar.date(from: DateComponents(year: 2026, month: month, day: day))!, session: nil, program: program, now: now, calendar: Self.calendar)
        }
        #expect(target(10, 27) == .programDay(ProgramRoute(programID: program.id, dayID: program.days[4].id)))
        #expect(target(10, 30) == .programDay(ProgramRoute(programID: program.id, dayID: program.days[0].id)))
        #expect(target(11, 1) == .programDay(ProgramRoute(programID: program.id, dayID: program.days[2].id)))
        #expect(target(10, 31) == nil)
        #expect(target(11, 6) == nil)
        let fromWednesday = { (day: Int) in
            DayPillTarget.of(Self.date(day, hour: 0), session: nil, program: program, now: Self.date(28, hour: 9), calendar: Self.calendar)
        }
        #expect(fromWednesday(27) == nil)
        #expect(DayPillTarget.of(Self.date(27, hour: 0), session: nil, program: nil, now: now, calendar: Self.calendar) == nil)
    }

    @Test func aLoggedDayOpensItsSummaryAndRollingProgramsOpenNothing() {
        let program = Self.weekly()
        let now = Self.date(27, hour: 9)
        let session = Self.finished(program, day: 0, cycle: 1)
        #expect(DayPillTarget.of(Self.date(26, hour: 0), session: session, program: program, now: now, calendar: Self.calendar) == .summary(session))
        let rolling = Program(name: "Rolling", color: .blue, cycles: 4, days: [ProgramDay(templateID: UUID()), ProgramDay()])
        #expect(DayPillTarget.of(Self.date(27, hour: 0), session: nil, program: rolling, now: now, calendar: Self.calendar) == nil)
    }
}
