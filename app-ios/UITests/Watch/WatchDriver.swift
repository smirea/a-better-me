import XCTest

/// Drives the watch app for `scripts/watch-drive`, which no other tool can tap. The test never ends on its own: it
/// runs each `cmd-<n>.json` written to `WATCH_DRIVER_DIR` against the app and answers in `out-<n>.txt`.
@MainActor
final class WatchDriver: XCTestCase {
    struct Command: Decodable {
        var op: String
        var args: [String] = []
    }

    func testDrive() throws {
        continueAfterFailure = true
        let dir = URL(fileURLWithPath: ProcessInfo.processInfo.environment["WATCH_DRIVER_DIR"] ?? "/tmp/watch-driver")
        let app = XCUIApplication()
        app.launch()
        // The driver installs its own build. A watch app launched right after an install comes up before the watch's
        // WatchConnectivity daemon links it to the phone app and hears nothing until relaunched (see scripts/run).
        RunLoop.current.run(until: .now.addingTimeInterval(3))
        app.terminate()
        app.launch()
        try Data("ready".utf8).write(to: dir.appending(path: "ready"))
        var index = 0
        while true {
            let input = dir.appending(path: "cmd-\(index).json")
            guard let data = try? Data(contentsOf: input) else {
                RunLoop.current.run(until: .now.addingTimeInterval(0.1))
                continue
            }
            let command = try JSONDecoder().decode(Command.self, from: data)
            let output: String
            do { output = try run(command, app: app, dir: dir) } catch { output = "error: \(error)" }
            try Data(output.utf8).write(to: dir.appending(path: "out-\(index).txt"))
            index += 1
            if command.op == "quit" { return }
        }
    }

    private func run(_ command: Command, app: XCUIApplication, dir: URL) throws -> String {
        let args = command.args
        switch command.op {
        case "tree":
            return app.debugDescription
        case "tap":
            let element = find(args.joined(separator: " "), in: app)
            guard element.waitForExistence(timeout: 3) else { return "not found: \(args.joined(separator: " "))" }
            let label = element.label
            element.tap()
            return "tapped \(label)"
        case "longpress":
            let element = find(args.joined(separator: " "), in: app)
            guard element.waitForExistence(timeout: 3) else { return "not found: \(args.joined(separator: " "))" }
            let label = element.label
            element.press(forDuration: 1)
            return "pressed \(label)"
        case "tapxy":
            let point = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: Double(args[0])!, dy: Double(args[1])!))
            point.tap()
            return "tapped \(args[0]),\(args[1])"
        case "crown":
            XCUIDevice.shared.rotateDigitalCrown(delta: Double(args[0])!, velocity: .default)
            return "rotated \(args[0])"
        case "home":
            XCUIDevice.shared.press(.home)
            return "pressed the crown"
        case "swipe":
            switch args.first {
            case "left": app.swipeLeft()
            case "right": app.swipeRight()
            case "up": app.swipeUp()
            default: app.swipeDown()
            }
            return "swiped \(args.first ?? "down")"
        case "shot":
            let path = args.first ?? dir.appending(path: "shot.png").path
            try XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: path))
            return path
        case "launch":
            app.terminate()
            app.launchArguments = args
            app.launch()
            return "launched \(args)"
        case "wait":
            let element = find(args.dropFirst().joined(separator: " "), in: app)
            return element.waitForExistence(timeout: Double(args[0]) ?? 5) ? "found" : "not found"
        case "sleep":
            RunLoop.current.run(until: .now.addingTimeInterval(Double(args.first ?? "1") ?? 1))
            return "slept"
        case "systree":
            return XCUIApplication(bundleIdentifier: args[0]).debugDescription
        case "systap":
            let system = XCUIApplication(bundleIdentifier: args[0])
            let element = find(args.dropFirst().joined(separator: " "), in: system)
            guard element.waitForExistence(timeout: 3) else { return "not found: \(args.dropFirst().joined(separator: " "))" }
            let label = element.label
            element.tap()
            return "tapped \(label)"
        case "quit":
            return "bye"
        default:
            return "unknown op \(command.op)"
        }
    }

    /// An element whose identifier or label is `text`, preferring buttons.
    private func find(_ text: String, in app: XCUIApplication) -> XCUIElement {
        let predicate = NSPredicate(format: "identifier == %@ OR label == %@", text, text)
        let button = app.buttons.matching(predicate).firstMatch
        return button.exists ? button : app.descendants(matching: .any).matching(predicate).firstMatch
    }
}
