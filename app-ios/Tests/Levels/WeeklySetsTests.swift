import Foundation
import Testing
@testable import App

private let press = Exercise(id: "press", name: "Press", type: .compound, primaryMuscles: [.chest], secondaryMuscles: [.triceps], metrics: [.weight, .reps])
private let fly = Exercise(id: "fly", name: "Fly", type: .isolation, primaryMuscles: [.chest], metrics: [.weight, .reps])
private let curl = Exercise(id: "curl", name: "Curl", type: .isolation, primaryMuscles: [.biceps], metrics: [.weight, .reps])
private func catalog(_ id: ExerciseID) -> Exercise? { ["press": press, "fly": fly, "curl": curl][id] }

private func logged(type: SetType = .standard) -> WorkoutSet {
    var set = WorkoutSet(type: type)
    set.log = SetLog(weightKg: 50, reps: 8, completedAt: .now)
    return set
}

private func session(_ date: String, _ items: [BlockExercise], finished: Bool = true) -> WorkoutSession {
    var session = WorkoutSession(name: "S", blocks: [WorkoutBlock(exercises: items)], startedAt: day(date, 18))
    session.endedAt = finished ? session.startedAt.addingTimeInterval(3600) : nil
    return session
}

struct WeeklySetsTests {
    private let sessions = [
        session("2026-10-07", [BlockExercise(exerciseID: "press", sets: [logged()])], finished: false),
        session("2026-10-06", [BlockExercise(exerciseID: "press", sets: [logged()])]),
        session("2026-10-05", [BlockExercise(exerciseID: "curl", sets: [logged(), logged(), logged()]), BlockExercise(exerciseID: "fly", sets: [logged()])]),
        session("2026-10-02", [BlockExercise(exerciseID: "press", sets: [logged(type: .warmUp), logged(), logged(), WorkoutSet()])]),
        session("2026-09-30", [BlockExercise(exerciseID: "press", sets: [logged()])]),
    ]

    @Test func oneWeekCountsFinishedWorkingSetsPerMuscleAndLift() {
        let weekly = WeeklySets(sessions: sessions, period: .oneWeek, now: day("2026-10-08", 12), calendar: utc, catalog: catalog)
        #expect(weekly.totals == [.chest: 4, .triceps: 1.5, .biceps: 3])
        #expect(weekly.top == 4)
        #expect(weekly.lifts(for: .chest).map(\.exerciseID) == ["press", "fly"])
        #expect(weekly.lifts(for: .chest).map(\.sets) == [3, 1])
        #expect(weekly.ranked([.biceps, .triceps, .chest, .quads]).map(\.muscle) == [.chest, .biceps, .triceps, .quads])
    }

    @Test func longerPeriodsAverageOverTheirWeeks() {
        let weekly = WeeklySets(sessions: sessions, period: .oneMonth, now: day("2026-10-08", 12), calendar: utc, catalog: catalog)
        #expect(weekly.sets(.chest) == 5 / (30.0 / 7))
        #expect(WeeklySets.label(weekly.sets(.chest)) == "1.2 sets")
    }
}

struct HistoryDayTests {
    @Test func groupsByDayNewestFirstKeepingTheGivenOrderWithinADay() {
        var late = session("2026-10-06", [])
        late.startedAt = day("2026-10-06", 20)
        let sessions = [late, session("2026-10-06", []), session("2026-10-02", []), session("2026-10-05", [])]
        let days = HistoryDay.group(sessions, calendar: utc)
        #expect(days.map(\.start) == [day("2026-10-06", 0), day("2026-10-05", 0), day("2026-10-02", 0)])
        #expect(days[0].sessions.map(\.id) == [sessions[0].id, sessions[1].id])
    }
}

struct BodyFigureCropTests {
    @Test func everyTileDrawsItsOwnMuscle() {
        let figure = BodyFigure.shared
        #expect(!figure.tiles.isEmpty)
        for (muscle, tile) in figure.tiles {
            let drawsMuscle = tile.parts.contains { if case .muscle(muscle) = $0.region { true } else { false } }
            #expect(drawsMuscle, "\(muscle) tile")
        }
    }
}
