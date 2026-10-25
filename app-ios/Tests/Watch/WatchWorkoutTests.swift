import Foundation
import Testing
@testable import App

struct WatchWorkoutTests {
    static let start = Date(timeIntervalSince1970: 1_000_000)

    static func id(_ n: Int) -> UUID { UUID(uuidString: String(format: "00000000-0000-0000-0000-%012d", n))! }

    static func exercise(_ n: Int, catalog: String, sets: Int) -> BlockExercise {
        BlockExercise(id: id(n), exerciseID: catalog, sets: (1...sets).map { WorkoutSet(id: id(n * 10 + $0)) })
    }

    /// Bench alone for 2 sets, then a superset of rows and curls for 2 rounds. Every set rests 120 s.
    static func workout() -> WatchWorkout {
        let blocks = [
            WorkoutBlock(id: id(1), exercises: [exercise(2, catalog: "bench", sets: 2)]),
            WorkoutBlock(id: id(3), exercises: [exercise(4, catalog: "row", sets: 2), exercise(5, catalog: "curl", sets: 2)]),
        ]
        let setIDs = blocks.flatMap(\.exercises).flatMap(\.sets).map(\.id)
        return WatchWorkout(
            sessionID: id(9), name: "Upper", startedAt: start, blocks: blocks, rules: FlowRules(), unit: .kg,
            exercises: ["bench": .init(name: "Bench", fields: [.weight, .reps]), "row": .init(name: "Row", fields: [.weight, .reps]), "curl": .init(name: "Curl", fields: [.weight, .reps])],
            restSeconds: Dictionary(uniqueKeysWithValues: setIDs.map { ($0, 120) }),
            prefill: [id(21): LiveValues(weightKg: 100, reps: 5, rir: 2)], previous: [id(22): LiveValues(weightKg: 102.0583, reps: 4, rir: 1)]
        )
    }

    static func event(_ kind: WatchEvent.Kind, after seconds: TimeInterval, id n: Int = 0) -> WatchEvent {
        WatchEvent(id: id(900 + n), sessionID: id(9), at: start.addingTimeInterval(seconds), kind: kind)
    }

    @Test func loggingAStraightSetRestsFromTheEventAndStaysOnTheExercise() {
        var workout = Self.workout()
        workout.apply(Self.event(.log(rowID: Self.id(21), values: LiveValues(weightKg: 100, reps: 5, rir: 2)), after: 60))

        #expect(workout.blocks[0].exercises[0].sets[0].log == SetLog(weightKg: 100, reps: 5, rir: 2, completedAt: Self.start.addingTimeInterval(60)))
        #expect(workout.rest == LiveRest(endsAt: Self.start.addingTimeInterval(180), duration: 120))
        #expect(workout.currentRow == RowPath(block: 0, exercise: 0, set: 1))
        #expect(workout.set(at: RowPath(block: 0, exercise: 0, set: 1)).position == "Set 2 of 2")
        #expect(workout.set(at: RowPath(block: 0, exercise: 0, set: 1)).previous == "102.1 kg x 4 @ 1 RIR")
    }

    @Test func supersetMembersAlternateAndRestOnlyAfterTheRound() {
        var workout = Self.workout()
        workout.apply(Self.event(.select(exerciseID: Self.id(4)), after: 0))
        workout.apply(Self.event(.log(rowID: Self.id(41), values: LiveValues(weightKg: 60, reps: 10)), after: 10))
        #expect(workout.rest == nil)
        #expect(workout.currentRow == RowPath(block: 1, exercise: 1, set: 0))
        #expect(workout.set(at: workout.currentRow!).position == "Superset 2 of 2 • Round 1 of 2")

        workout.apply(Self.event(.log(rowID: Self.id(51), values: LiveValues(weightKg: 15, reps: 12)), after: 40))
        #expect(workout.rest == LiveRest(endsAt: Self.start.addingTimeInterval(160), duration: 120))
        #expect(workout.currentRow == RowPath(block: 1, exercise: 0, set: 1))
    }

    @Test func replayingEventsConvergesOnTheSameWorkout() {
        let events = [
            Self.event(.log(rowID: Self.id(21), values: LiveValues(weightKg: 100, reps: 5)), after: 60, id: 1),
            Self.event(.unlog(rowID: Self.id(21)), after: 70, id: 2),
            Self.event(.log(rowID: Self.id(21), values: LiveValues(weightKg: 102.5, reps: 4)), after: 80, id: 3),
        ]
        let once = Self.workout().applying(events)
        let twice = once.applying(events)

        #expect(once.blocks[0].exercises[0].sets[0].log?.weightKg == 102.5)
        #expect(twice.blocks == once.blocks)
        #expect(twice.completedSets == 1)
    }

    @Test func pauseFreezesRestAndResumeAddsThePause() {
        var workout = Self.workout()
        workout.apply(Self.event(.log(rowID: Self.id(21), values: LiveValues(weightKg: 100, reps: 5)), after: 60))
        workout.apply(Self.event(.pause, after: 100))
        #expect(workout.rest == nil)
        #expect(workout.elapsed(at: Self.start.addingTimeInterval(500)) == 100)

        workout.apply(Self.event(.resume, after: 400))
        #expect(workout.pausedSeconds == 300)
        #expect(workout.rest == LiveRest(endsAt: Self.start.addingTimeInterval(480), duration: 80))
        #expect(workout.elapsed(at: Self.start.addingTimeInterval(500)) == 200)
    }

    @Test func addedSetCopiesTheLastSetsRestAndValues() {
        var workout = Self.workout()
        workout.apply(Self.event(.log(rowID: Self.id(21), values: LiveValues(weightKg: 100, reps: 5)), after: 60))
        workout.apply(Self.event(.addSet(exerciseID: Self.id(2), setID: Self.id(29)), after: 70))
        workout.apply(Self.event(.addSet(exerciseID: Self.id(2), setID: Self.id(29)), after: 71))

        #expect(workout.blocks[0].exercises[0].sets.map(\.id) == [Self.id(21), Self.id(22), Self.id(29)])
        #expect(workout.restSeconds[Self.id(29)] == 120)
        #expect(workout.totalSets == 7)
    }

    @Test func aLogOnAnAddedDropSurvivesReplay() {
        var plan = Self.workout()
        plan.blocks[0].exercises[0].sets[1].type = .drop
        plan.blocks[0].exercises[0].sets[1].subSets = [SubSet(id: Self.id(221))]
        let added = Self.event(.addSet(exerciseID: Self.id(2), setID: Self.id(29)), after: 10, id: 1)
        let withSet = plan.applying([added])
        let drop = withSet.blocks[0].exercises[0].sets[2].subSets[0].id
        let log = Self.event(.log(rowID: drop, values: LiveValues(weightKg: 60, reps: 6)), after: 20, id: 2)

        let replayed = plan.applying([added, log])
        var phone = plan.blocks
        phone.addSet(to: Self.id(2), id: Self.id(29))

        #expect(replayed.blocks[0].exercises[0].sets[2].subSets[0].log?.reps == 6)
        #expect(phone[0].exercises[0].sets[2].subSets[0].id == drop)
    }

    @Test func finishingWhilePausedEndsAtTheFinishWithThePauseCounted() {
        var workout = Self.workout()
        workout.apply(Self.event(.pause, after: 600))
        workout.apply(Self.event(.finish, after: 900))

        #expect(workout.endedAt == Self.start.addingTimeInterval(900))
        #expect(workout.pausedSeconds == 300)
        #expect(workout.elapsed(at: Self.start.addingTimeInterval(5000)) == 600)
    }
}

struct WatchReplicaTests {
    typealias Fixture = WatchWorkoutTests

    static func started(_ minutes: TimeInterval) -> (WatchReplica, WatchEvent) {
        var replica = WatchReplica()
        let start = replica.start(Fixture.workout(), at: Fixture.start.addingTimeInterval(minutes * 60))
        return (replica, start)
    }

    @Test func theWatchKeepsItsOwnWorkoutUntilThePhoneHasTheStart() {
        var (replica, start) = Self.started(0)
        replica.record(.log(rowID: Fixture.id(21), values: LiveValues(weightKg: 100, reps: 5)), at: Fixture.start.addingTimeInterval(60))

        replica.receive(nil, acknowledged: [])

        #expect(replica.workout?.sessionID == start.sessionID)
        #expect(replica.workout?.completedSets == 1)
        #expect(replica.outbox.count == 2)
    }

    @Test func acknowledgedEventsLeaveTheOutboxAndThePhonesCopyWins() {
        var (replica, start) = Self.started(0)
        let log = replica.record(.log(rowID: Fixture.id(21), values: LiveValues(weightKg: 100, reps: 5)), at: Fixture.start.addingTimeInterval(60))!
        let skip = replica.record(.skipRest, at: Fixture.start.addingTimeInterval(70))!
        var remote = replica.workout!.applying([])
        remote.blocks = replica.workout!.blocks
        remote.prefill[Fixture.id(22)] = LiveValues(weightKg: 105, reps: 5)

        replica.receive(remote, acknowledged: [start.id, log.id])

        #expect(replica.outbox.map(\.id) == [skip.id])
        #expect(replica.workout?.prefill[Fixture.id(22)] == LiveValues(weightKg: 105, reps: 5))
    }

    @Test func aLateCopyOfAnOlderFinishedWorkoutDoesNotClearTheSummary() {
        var older = Fixture.workout()
        older.sessionID = Fixture.id(700)
        older.endedAt = Fixture.start.addingTimeInterval(600)
        var (replica, start) = Self.started(30)
        let finish = replica.record(.finish, at: Fixture.start.addingTimeInterval(40 * 60))!
        replica.receive(nil, acknowledged: [start.id, finish.id])

        replica.receive(older, acknowledged: [])

        #expect(replica.workout?.sessionID == start.sessionID)
        #expect(replica.workout?.isFinished == true)
    }

    @Test func aWorkoutFinishedOnThePhoneLeavesTheWatch() {
        var replica = WatchReplica()
        replica.receive(Fixture.workout(), acknowledged: [])
        #expect(replica.workout?.sessionID == Fixture.id(9))

        replica.receive(nil, acknowledged: [])

        #expect(replica.workout == nil)
    }

    @Test func aClosedWorkoutStaysClosed() {
        var replica = WatchReplica()
        replica.receive(Fixture.workout(), acknowledged: [])
        replica.close()

        replica.receive(Fixture.workout(), acknowledged: [])

        #expect(replica.workout == nil)
        #expect(replica.closed == [Fixture.id(9)])
    }
}
