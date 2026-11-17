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
}

struct NewProgramWizardRulesTests {
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
        #expect(program.cycleProgress(finishedDays: []) == 0)
        #expect(program.cycleProgress(finishedDays: program.finishedDayIDs([Self.finished(program, day: 0, cycle: 1)])) == 1.0 / 3.0)
        #expect(program.cycleProgress(finishedDays: program.finishedDayIDs([Self.finished(program, day: 0, cycle: 1), Self.finished(program, day: 2, cycle: 1)])) == 2.0 / 3.0)
        #expect(program.cycleProgress(finishedDays: program.finishedDayIDs([Self.finished(program, day: 0, cycle: 2)])) == 0)
        let restOnly = Program(name: "Rest", color: .blue, cycles: 1, days: [ProgramDay()])
        #expect(restOnly.cycleProgress(finishedDays: []) == 0)
    }
}

struct WorkoutOverviewTests {
    private static let bench = Exercise(id: "bench", name: "Bench Press", type: .compound, primaryMuscles: [.chest], secondaryMuscles: [.triceps], metrics: [.weight, .reps])
    private static let plank = Exercise(id: "plank", name: "Plank", type: .isolation, primaryMuscles: [.abs], metrics: [.duration])

    private static func catalog(_ id: ExerciseID) -> Exercise? { [bench, plank].first { $0.id == id } }

    @Test func countsExercisesAndWorkingSetsAndWeighsSecondaryMusclesHalf() {
        let sets = [WorkoutSet(type: .warmUp), WorkoutSet(), WorkoutSet(), WorkoutSet()]
        let blocks = [
            WorkoutBlock(exercises: [BlockExercise(exerciseID: "bench", sets: sets)]),
            WorkoutBlock(exercises: [BlockExercise(exerciseID: "plank", sets: [WorkoutSet()])]),
        ]
        let overview = WorkoutOverview(blocks: blocks, catalog: Self.catalog)
        #expect(overview.line == "2 exercises · 4 sets")
        #expect(overview.muscleSets == [.chest: 3, .triceps: 1.5, .abs: 1])
    }

    @Test func completionsCountFinishedSessionsPerTemplateAndPerProgramDay() {
        let push = UUID()
        let pull = UUID()
        let monday = UUID()
        func session(_ template: UUID?, day: UUID? = nil, finished: Bool = true) -> WorkoutSession {
            var session = WorkoutSession(name: "W", templateID: template)
            session.program = day.map { ProgramPosition(programID: UUID(), dayID: $0, cycle: 1) }
            if finished { session.endedAt = session.startedAt.addingTimeInterval(3600) }
            return session
        }
        let counts = WorkoutOverview.completions(in: [
            session(push), session(push, day: monday), session(pull), session(pull, finished: false), session(nil, day: monday), session(nil),
        ])
        #expect(counts == [push: 2, pull: 1, monday: 2])
    }
}
