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
        // A cold launch right after a build, on a Mac busy with other simulators, can take a minute to ask.
        let deadline = Date.now.addingTimeInterval(180)
        while !permissionsSettled, Date.now < deadline {
            RunLoop.current.run(until: .now.addingTimeInterval(0.5))
            answerNextPrompt()
        }
        XCTAssertTrue(permissionsSettled, "The app never finished asking for its permissions.")
        print("PermissionsGrant: done, Health \(pressedPrimary ? "answered" : "not asked")")
    }

    private var pressedPrimary = false
    private var pickedRange = false

    /// Reads every element through `snapshot()`, which throws when the element is gone, and taps a point from that
    /// snapshot. A query resolves its element again on every read, and Health's sheet swaps views while it loads (a
    /// progress indicator where a button was), so `exists` and then `isEnabled`, `isHittable`, or `tap()` found nothing,
    /// which fails and ends a UI test on the spot (#137). A pass that loses an element does nothing; the next one reads
    /// again.
    private func answerNextPrompt() {
        // Alerts that aren't permission prompts, such as "Open in …?", are left alone.
        let alert = springboard.alerts.firstMatch
        if alert.exists, let allow = alert.buttons.matching(NSPredicate(format: "label IN %@", ["Allow", "OK", "Allow While Using App"])).firstMatch.read() {
            print("PermissionsGrant: allowed \(alert.read()?.label ?? "an alert")")
            tap(springboard, allow.frame)
            return
        }
        // Frames inside Health's sheet, which another process draws, come relative to the sheet's host view.
        let sheet = healthSheetOrigin()
        func onScreen(_ frame: CGRect) -> CGRect { frame.offsetBy(dx: sheet.x, dy: sheet.y) }
        if let allTopics = app.cells["UIA.Health.AuthSheet.AllCategoryButton"].read(),
           allTopics.all.contains(where: { $0.elementType == .staticText && $0.label.hasPrefix("Select All") }) {
            // A sheet still loading its topics shows only its buttons, and the swipes that reach them leave this
            // row scrolled off, where taps land on nothing.
            if visible(onScreen(allTopics.frame)) {
                print("PermissionsGrant: Health, select all topics")
                tap(app, onScreen(allTopics.frame))
            } else {
                app.swipeDown()
            }
            return
        }
        if !pickedRange, let range = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH 'All Recorded Data'")).firstMatch.read() {
            print("PermissionsGrant: Health, all recorded data")
            tap(app, onScreen(range.frame))
            pickedRange = true
            return
        }
        if let allow = app.buttons["Allow"].read(), allow.isEnabled {
            print("PermissionsGrant: Health, allow")
            tap(app, onScreen(allow.frame))
            pressedPrimary = true
            return
        }
        // Allow or Continue over Don't Allow, as two labels in one cell whose own frames are wrong, so the tap
        // goes to the cell's top half.
        if let buttons = app.cells.containing(NSPredicate(format: "label == %@", "Don’t Allow")).firstMatch.read() {
            if visible(onScreen(buttons.frame)) {
                print("PermissionsGrant: Health, primary button")
                tap(app, onScreen(buttons.frame), y: 0.25)
                pressedPrimary = true
            } else {
                app.swipeUp()
            }
        }
    }

    /// Health's sheet ignores element taps, so this taps a point in the frame instead: its middle across, `y` of the
    /// way down.
    private func tap(_ application: XCUIApplication, _ frame: CGRect, y: CGFloat = 0.5) {
        application.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: frame.midX, dy: frame.minY + frame.height * y)).tap()
    }

    private func visible(_ frame: CGRect) -> Bool {
        app.frame.contains(CGPoint(x: frame.midX, y: frame.midY))
    }

    /// Where Health's sheet sits on screen. Its host view shows in the app's snapshot as a view at the sheet's position
    /// holding content of the same size at the origin (`XCUIElement.frame` adds that origin, but reading it fails when
    /// the element is gone). Without the sheet there is no such pair and the origin is zero.
    private func healthSheetOrigin() -> CGPoint {
        guard let root = try? app.snapshot() else { return .zero }
        let host = root.all.first { node in
            node.frame.origin != .zero && node.children.contains { $0.frame.origin == .zero && $0.frame.size == node.frame.size }
        }
        return host?.frame.origin ?? .zero
    }
}

private extension XCUIElement {
    /// The element now, or nil when it is gone, without the failure a property read records.
    func read() -> XCUIElementSnapshot? {
        guard exists else { return nil }
        return try? snapshot()
    }
}

private extension XCUIElementSnapshot {
    /// This element and everything under it.
    var all: [XCUIElementSnapshot] {
        [self] + children.flatMap(\.all)
    }
}
