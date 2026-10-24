import Foundation
@testable import App

/// MF's observed biceps curl in lb: a drop set targeting 8 @0 with one sub-row, then two sets targeting 8-12 @2.
enum CurlFixture {
    static let lb = WeightUnit.lb
    static let increment = 5.0

    static func logged(_ weightLb: Double?, _ reps: Int?, _ rir: Int?, at seconds: TimeInterval = 0) -> SetLog {
        SetLog(weightKg: weightLb.map(lb.toKg), reps: reps, rir: rir, completedAt: Date(timeIntervalSinceReferenceDate: seconds))
    }

    static var sets: [WorkoutSet] {
        var drop = WorkoutSet(type: .drop, target: SetTarget(repsMin: 8, rir: 0))
        drop.subSets = [SubSet()]
        let working = SetTarget(repsMin: 8, repsMax: 12, rir: 2)
        return [drop, WorkoutSet(target: working), WorkoutSet(target: working)]
    }

    static var previous: [WorkoutSet] {
        var drop = WorkoutSet(type: .drop, log: logged(30, 12, 2))
        drop.subSets = [SubSet()]
        return [drop, WorkoutSet(log: logged(35, 10, 1)), WorkoutSet(log: logged(35, 10, 0))]
    }

    static func suggest(sets: [WorkoutSet] = sets, previous: [WorkoutSet] = previous, settings: ProgressionSettings = ProgressionSettings(), rirTracking: Bool = true) -> [UUID: SetSuggestion] {
        SmartProgression.suggest(sets: sets, previous: previous, settings: settings, increment: increment, rirTracking: rirTracking, unit: lb)
    }
}
