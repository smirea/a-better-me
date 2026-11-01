import XCTest

/// Set by the Darwin notification `AppPermissions` posts once every launch-time prompt has an answer. The observer
/// callback is a C function pointer and can't capture, so the flag lives at file scope.
nonisolated(unsafe) private var permissionsSettled = false

/// Answers every permission prompt the app shows at launch, so a simulator starts with everything granted
/// (`scripts/run` runs it whenever the app's last launch left a prompt unanswered).
@MainActor
final class PermissionsGrant: XCTestCase {
    private let app = XCUIApplication()
    private let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")

    func testGrantAll() {
        // `scripts/run` passes `-health on|off` as `TEST_RUNNER_APP_ARGUMENTS`; xcodebuild drops the prefix.
        app.launchArguments = ProcessInfo.processInfo.environment["APP_ARGUMENTS"]?.split(separator: " ").map(String.init) ?? []
        permissionsSettled = false
        CFNotificationCenterAddObserver(CFNotificationCenterGetDarwinNotifyCenter(), nil, { _, _, _, _, _ in permissionsSettled = true },
            "com.stefan.a-better-me.permissions-settled" as CFString, nil, .deliverImmediately)
        app.launch()
        var pressedPrimary = false
        var pickedRange = false
        // A cold launch right after a build, on a Mac busy with other simulators, can take a minute to ask.
        let deadline = Date.now.addingTimeInterval(180)
        while !permissionsSettled, Date.now < deadline {
            RunLoop.current.run(until: .now.addingTimeInterval(0.5))
            // Alerts that aren't permission prompts, such as "Open in …?", are left alone.
            let alert = springboard.alerts.firstMatch
            let allowAlert = alert.buttons.matching(NSPredicate(format: "label IN %@", ["Allow", "OK", "Allow While Using App"])).firstMatch
            if alert.exists, allowAlert.exists {
                print("PermissionsGrant: allowed \(alert.label)")
                allowAlert.tap()
                continue
            }
            let allTopics = app.cells["UIA.Health.AuthSheet.AllCategoryButton"]
            if allTopics.exists, allTopics.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Select All'")).count > 0 {
                print("PermissionsGrant: Health, select all topics")
                // A sheet still loading its topics shows only its buttons, and the swipes that reach them leave this
                // row scrolled off, where taps land on nothing.
                for _ in 0..<12 where !allTopics.isHittable { app.swipeDown() }
                tapCenter(allTopics)
                continue
            }
            let range = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH 'All Recorded Data'")).firstMatch
            if range.exists, !pickedRange {
                print("PermissionsGrant: Health, all recorded data")
                tapCenter(range)
                pickedRange = true
                continue
            }
            let allow = app.buttons["Allow"]
            if allow.exists, allow.isEnabled {
                print("PermissionsGrant: Health, allow")
                tapCenter(allow)
                pressedPrimary = true
                continue
            }
            // Allow or Continue over Don't Allow, as two labels in one cell whose own frames are wrong, so the tap
            // goes to the cell's top half.
            let buttons = app.cells.containing(NSPredicate(format: "label == %@", "Don’t Allow")).firstMatch
            if buttons.exists {
                print("PermissionsGrant: Health, primary button")
                for _ in 0..<12 where !buttons.isHittable { app.swipeUp() }
                buttons.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.25)).tap()
                pressedPrimary = true
            }
        }
        XCTAssertTrue(permissionsSettled, "The app never finished asking for its permissions.")
        print("PermissionsGrant: done, Health \(pressedPrimary ? "answered" : "not asked")")
    }

    /// Health's sheet ignores element taps, so this taps the element's center point instead.
    private func tapCenter(_ element: XCUIElement) {
        element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }
}
