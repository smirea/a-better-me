#if os(iOS)
import AppIntents
import Foundation

/// Every Live Activity button: one command for the phone's `LiveWorkoutController`. A `LiveActivityIntent` runs in
/// the app's process, which installs `handler` at launch, so the widget extension never sees the controller.
struct LiveWorkoutIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Control Workout"
    static let isDiscoverable = false

    @MainActor static var handler: ((LiveWorkoutCommand) async -> Void)?

    /// The command as JSON, since an intent parameter can't hold an enum with associated values.
    @Parameter(title: "Command") var command: String

    init() {}

    init(_ command: LiveWorkoutCommand) {
        self.command = String(decoding: try! JSONEncoder().encode(command), as: UTF8.self)
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        guard let handler = Self.handler else { throw Failure.notInstalled }
        await handler(try JSONDecoder().decode(LiveWorkoutCommand.self, from: Data(command.utf8)))
        return .result()
    }

    enum Failure: Error {
        case notInstalled
    }
}

enum LiveActivityLink {
    /// Opens the app on the live workout: the activity's tap target and its Finish button.
    static let liveWorkout = URL(string: "abetterme://workout/live")!
}
#endif
