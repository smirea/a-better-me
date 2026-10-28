import XCTest

/// Answers every permission prompt the app shows at launch, so a fresh simulator starts with everything granted
/// (`scripts/run` runs it after a first install).
@MainActor
final class PermissionsGrant: XCTestCase {
    private let app = XCUIApplication()
    private let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")

    func testGrantAll() {
        // `scripts/run` passes `-health on|off` as `TEST_RUNNER_APP_ARGUMENTS`; xcodebuild drops the prefix.
        app.launchArguments = ProcessInfo.processInfo.environment["APP_ARGUMENTS"]?.split(separator: " ").map(String.init) ?? []
        app.launch()
        var pressedPrimary = false
        var pickedRange = false
        var quietSince = Date.now
        let deadline = Date.now.addingTimeInterval(120)
        // Without a Health sheet (already granted, or Health off) it waits long enough for the launch-time request to
        // show one, longer when Health is on because a cold launch right after a build can be slow to show its sheet.
        let healthWait: TimeInterval = app.launchArguments.contains("on") ? 30 : 10
        while Date.now < deadline, Date.now.timeIntervalSince(quietSince) < (pressedPrimary ? 4 : healthWait) {
            RunLoop.current.run(until: .now.addingTimeInterval(0.5))
            // Alerts that aren't permission prompts, such as "Open in …?", are left alone.
            let alert = springboard.alerts.firstMatch
            let allowAlert = alert.buttons.matching(NSPredicate(format: "label IN %@", ["Allow", "OK", "Allow While Using App"])).firstMatch
            if alert.exists, allowAlert.exists {
                print("PermissionsGrant: allowed \(alert.label)")
                allowAlert.tap()
                quietSince = .now
                continue
            }
            let allTopics = app.cells["UIA.Health.AuthSheet.AllCategoryButton"]
            if allTopics.exists, allTopics.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Select All'")).count > 0 {
                print("PermissionsGrant: Health, select all topics")
                tapCenter(allTopics)
                quietSince = .now
                continue
            }
            let range = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH 'All Recorded Data'")).firstMatch
            if range.exists, !pickedRange {
                print("PermissionsGrant: Health, all recorded data")
                tapCenter(range)
                pickedRange = true
                quietSince = .now
                continue
            }
            let allow = app.buttons["Allow"]
            if allow.exists, allow.isEnabled {
                print("PermissionsGrant: Health, allow")
                tapCenter(allow)
                pressedPrimary = true
                quietSince = .now
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
                quietSince = .now
            }
        }
        print("PermissionsGrant: done, Health \(pressedPrimary ? "answered" : "not asked")")
    }

    /// Health's sheet ignores element taps, so this taps the element's center point instead.
    private func tapCenter(_ element: XCUIElement) {
        element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }
}
