import Foundation

/// Everything the phone and the watch app say to each other. During a workout it travels over the mirrored
/// `HKWorkoutSession`'s data channel; otherwise, and when no session is mirrored, over WatchConnectivity. Both ends may
/// run different builds for a moment, so like the live workout contract it only grows.
enum WatchMessage: Codable, Sendable {
    // Phone to watch.
    /// The workout in progress, or the one that just ended with `endedAt` set, and the watch events the phone has
    /// applied to it so far. Nil once no workout is in progress.
    case workout(WatchWorkout?, acknowledged: [UUID])
    case home(WatchHome)
    /// The watch's recording is thrown away: the workout was discarded on the phone, or the phone already recorded
    /// most of it.
    case discardRecording(sessionID: UUID)

    // Watch to phone.
    /// The watch's outbox, oldest first, resent until the phone acknowledges each event.
    case events([WatchEvent])
    case recorded(sessionID: UUID, WorkoutHealthSummary)
    /// The watch records the workout. Sent over WatchConnectivity, since a mirrored session can fail to reach the phone.
    case recordingStarted
    /// The watch recording's numbers, for the phone and its Live Activity when no mirror carries them.
    case stats(WorkoutRecording.Stats)
    /// The watch app opened and wants the current home list and workout.
    case hello

    func encoded() throws -> Data { try JSONEncoder().encode(self) }

    init(_ data: Data) throws { self = try JSONDecoder().decode(Self.self, from: data) }

    /// WatchConnectivity dictionary keys: a message or user info carries one encoded message, and the application
    /// context the latest home list and workout.
    static let messageKey = "message"
    static let homeKey = "home"
    static let workoutKey = "workout"
}

/// The watch's home list: the active program's next workout first, then the library.
struct WatchHome: Codable, Hashable, Sendable {
    var workouts: [WatchWorkoutOption]
}

struct WatchWorkoutOption: Codable, Hashable, Sendable, Identifiable {
    var id: UUID
    var name: String
    /// "Up next in Push Pull Legs", or nil for a library workout.
    var program: String?
    var exercises: [String]
    var totalSets: Int
    /// The workout as it would start now, so the watch can start it with the phone out of reach.
    var plan: WatchWorkout?
}

/// What the recording device needs to close the workout: its end, the name for the metadata, one segment per exercise,
/// and an effort score, worked out by `HealthRecordingPlan` from the logged sets.
struct WorkoutRecordingPlan: Codable, Hashable, Sendable {
    struct Segment: Codable, Hashable, Sendable {
        var exercise: String
        var start: Date
        var end: Date
    }

    var sessionID: UUID
    var name: String
    var endedAt: Date
    var segments: [Segment]
    /// 1-10 on Apple's workout effort scale, or nil when no logged set has an RIR.
    var effort: Double?
}
