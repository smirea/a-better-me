import Foundation

/// Everything the phone and the watch app say to each other. During a workout it travels over the mirrored
/// `HKWorkoutSession`'s data channel; otherwise, and when no session is mirrored, over WatchConnectivity. Both ends may
/// run different builds for a moment, so like the live workout contract it only grows.
enum WatchMessage: Codable, Sendable {
    // Phone to watch.
    /// The in-progress workout, or nil once none is.
    case snapshot(LiveWorkoutSnapshot?)
    case home(WatchHome)
    /// Sent when the workout ends, and again once its Health summary is saved.
    case finished(WatchWorkoutSummary)
    /// Ends the watch's recording and saves it to Health with what only the phone knows.
    case record(WorkoutRecordingPlan)
    /// The workout was discarded on the phone, so the recording is thrown away.
    case discardRecording(sessionID: UUID)

    // Watch to phone.
    case command(LiveWorkoutCommand)
    /// Starts a workout from the watch's list. The phone starts it like a tap on its own Start button.
    case start(templateID: UUID)
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
    /// context the latest home list and snapshot.
    static let messageKey = "message"
    static let homeKey = "home"
    static let snapshotKey = "snapshot"
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
}

/// The watch's finish screen.
struct WatchWorkoutSummary: Codable, Hashable, Sendable {
    var sessionID: UUID
    var name: String
    var duration: TimeInterval
    var completedSets: Int
    var volumeKg: Double
    var unit: WeightUnit
    var health: WorkoutHealthSummary?
}

/// What the recording device needs to close the workout: its end, the name for the metadata, one segment per exercise,
/// and an effort score. The phone builds it, since only the phone has the logged sets.
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
