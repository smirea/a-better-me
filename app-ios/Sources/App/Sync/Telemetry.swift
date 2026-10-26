import Foundation
import Sentry
import SyncEngine

/// The app's only use of Sentry. Until `start` runs the SDK ignores every call, so callers never check whether
/// reporting is on.
enum Telemetry {
    /// First thing at launch, so a crash during the rest of launch is still reported. Crash capture is on by default.
    static func start() {
        guard let dsn = AppEnvironment.sentryDSN, !isTestRun else { return }
        SentrySDK.start { options in
            options.dsn = dsn
            // Performance is a top priority, so a stall the owner can feel is reported, not only the SDK's 2 s hang.
            options.appHangTimeoutInterval = 0.5
            // The owner is the only user, so every launch, screen load, and tap is traced and profiled: a slow tap
            // arrives with the main thread's stacks. Session replay stays off, because it snapshots the screen on main.
            options.tracesSampleRate = 1
            options.configureProfiling = {
                $0.sessionSampleRate = 1
                $0.lifecycle = .trace
                $0.profileAppStarts = true
            }
            options.attachScreenshot = true
            options.attachViewHierarchy = true
            #if DEBUG
            options.environment = "development"
            #else
            options.environment = "production"
            #endif
        }
    }

    /// Unit tests run inside the app, and their sync failures against no server are not the owner's.
    private static var isTestRun: Bool { ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil }

    /// Warns once per distinct sync failure and per refused write while the app runs. The client keeps retrying a
    /// failure and lists its last 20 refusals on every change, so reporting each change would repeat the same event.
    @MainActor static func watch(_ client: SyncClient) {
        Task { @MainActor in
            var reported = Set<String>()
            for await (status, rejected) in Observations({ (client.status, client.rejected) }) {
                switch status {
                case let .failed(reason) where reported.insert("failed \(reason)").inserted:
                    warn("Sync failed: \(reason)", extras: ["reason": reason])
                case .unauthorized where reported.insert("unauthorized").inserted:
                    warn("Sync unauthorized: the server refused the owner token", extras: [:])
                default:
                    break
                }
                for write in rejected where reported.insert("rejected \(write.table) \(write.id) \(write.reason)").inserted {
                    warn(
                        "Sync rejected a write to \(write.table)",
                        extras: ["table": write.table, "id": write.id, "reason": write.reason]
                    )
                }
            }
        }
    }

    private static func warn(_ message: String, extras: [String: Any]) {
        SentrySDK.capture(message: message) { scope in
            scope.setLevel(.warning)
            scope.setExtras(extras)
        }
    }
}
