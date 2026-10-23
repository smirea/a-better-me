// Drives an iOS simulator through its Device Hub window. Run it through `scripts/sim`, which compiles it.
import AppKit
import ApplicationServices

struct Node {
    let role: String
    let label: String
    let frame: CGRect
}

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("sim: \(message)\n".utf8))
    exit(1)
}

func attr(_ element: AXUIElement, _ name: String) -> AnyObject? {
    var value: AnyObject?
    AXUIElementCopyAttributeValue(element, name as CFString, &value)
    return value
}

func frame(_ element: AXUIElement) -> CGRect? {
    guard let p = attr(element, kAXPositionAttribute), let s = attr(element, kAXSizeAttribute) else { return nil }
    var origin = CGPoint.zero, size = CGSize.zero
    AXValueGetValue(p as! AXValue, .cgPoint, &origin)
    AXValueGetValue(s as! AXValue, .cgSize, &size)
    return CGRect(origin: origin, size: size)
}

func deviceHubPID() -> pid_t {
    let windows = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as! [[String: Any]]
    guard let window = windows.first(where: { ($0[kCGWindowOwnerName as String] as? String) == "Device Hub" }) else {
        fail("Device Hub is not running. Launch the app with ./scripts/run first.")
    }
    return window[kCGWindowOwnerPID as String] as! pid_t
}

/// The device's Device Hub window, matched by the device name in its title ("iPhone 18 Pro – iOS 27.0").
func deviceWindow(_ device: String) -> AXUIElement {
    let app = AXUIElementCreateApplication(deviceHubPID())
    let windows = attr(app, kAXWindowsAttribute) as? [AXUIElement] ?? []
    let matches = windows.filter { (attr($0, kAXTitleAttribute) as? String ?? "").hasPrefix("\(device) –") }
    guard matches.count == 1 else {
        let titles = windows.compactMap { attr($0, kAXTitleAttribute) as? String }
        fail("expected one Device Hub window for \"\(device)\", found \(matches.count). Open windows: \(titles)")
    }
    return matches[0]
}

func nodes(in element: AXUIElement, into result: inout [Node]) {
    let role = attr(element, kAXRoleAttribute) as? String ?? ""
    let label = [kAXTitleAttribute, kAXDescriptionAttribute, kAXValueAttribute]
        .compactMap { attr(element, $0).map { "\($0)" } }
        .filter { !$0.isEmpty }
        .joined(separator: " ¦ ")
        .replacingOccurrences(of: "\n", with: " ")
    if !label.isEmpty, let f = frame(element), f.width > 0 { result.append(Node(role: role, label: label, frame: f)) }
    for child in attr(element, kAXChildrenAttribute) as? [AXUIElement] ?? [] { nodes(in: child, into: &result) }
}

/// App elements only: Device Hub's own chrome (title, toolbar buttons) sits outside the device screen.
func screenNodes(_ window: AXUIElement) -> [Node] {
    var all: [Node] = []
    nodes(in: window, into: &all)
    guard let windowFrame = frame(window) else { return all }
    let screen = windowFrame.insetBy(dx: 20, dy: 60)
    var seen = Set<String>()
    return all.filter { node in
        guard node.role != "AXWindow", screen.intersects(node.frame) else { return false }
        return seen.insert("\(node.label)\(node.frame)").inserted
    }
}

func post(_ type: CGEventType, _ point: CGPoint) {
    CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: point, mouseButton: .left)!.post(tap: .cghidEventTap)
}

/// Every agent on this Mac shares one mouse, so input holds a lock for the whole raise-and-click.
func withInputLock(_ body: () -> Void) {
    let lock = "/tmp/a-better-me-sim-input.lock"
    let fd = open(lock, O_CREAT | O_RDWR, 0o666)
    guard fd >= 0, flock(fd, LOCK_EX) == 0 else { fail("cannot lock \(lock)") }
    defer { flock(fd, LOCK_UN); close(fd) }
    body()
}

func raise(_ window: AXUIElement) {
    NSRunningApplication(processIdentifier: deviceHubPID())?.activate()
    AXUIElementPerformAction(window, kAXRaiseAction as CFString)
    usleep(250_000)
}

func click(_ window: AXUIElement, _ point: CGPoint) {
    withInputLock {
        raise(window)
        post(.mouseMoved, point)
        usleep(50_000)
        post(.leftMouseDown, point)
        usleep(60_000)
        post(.leftMouseUp, point)
        usleep(400_000)
    }
}

func drag(_ window: AXUIElement, from a: CGPoint, to b: CGPoint) {
    withInputLock {
        raise(window)
        post(.leftMouseDown, a)
        for step in 1...20 {
            let t = Double(step) / 20
            post(.leftMouseDragged, CGPoint(x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t))
            usleep(15_000)
        }
        usleep(100_000)
        post(.leftMouseUp, b)
        usleep(400_000)
    }
}

func type(_ window: AXUIElement, _ text: String) {
    withInputLock {
        raise(window)
        for unit in text.utf16 {
            for down in [true, false] {
                let event = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: down)!
                var character = unit
                event.keyboardSetUnicodeString(stringLength: 1, unicodeString: &character)
                event.post(tap: .cghidEventTap)
            }
            usleep(20_000)
        }
    }
}

func center(_ r: CGRect) -> CGPoint { CGPoint(x: r.midX, y: r.midY) }

/// The device screen: the window's largest unlabeled group below the title bar.
func screenFrame(_ window: AXUIElement) -> CGRect {
    var best = CGRect.zero
    func visit(_ element: AXUIElement, depth: Int) {
        if depth > 3 { return }
        if attr(element, kAXRoleAttribute) as? String == "AXGroup", let f = frame(element), f.minY > frame(window)!.minY + 40,
           f.width * f.height > best.width * best.height {
            best = f
        }
        for child in attr(element, kAXChildrenAttribute) as? [AXUIElement] ?? [] { visit(child, depth: depth + 1) }
    }
    visit(window, depth: 0)
    guard best != .zero else { fail("cannot find the device screen in the Device Hub window") }
    return best
}

var args = Array(CommandLine.arguments.dropFirst())
var device = ProcessInfo.processInfo.environment["SIM_DEVICE"] ?? ""
if let i = args.firstIndex(of: "-d"), i + 1 < args.count {
    device = args[i + 1]
    args.removeSubrange(i...(i + 1))
}
guard !device.isEmpty else { fail("pass -d <simulator name> or set SIM_DEVICE") }
guard let command = args.first else {
    fail("usage: sim [-d device] ui | tap <label> [n] | tapxy <x> <y> | tapfrac <fx> <fy> | swipe <up|down|left|right> | type <text>")
}
let window = deviceWindow(device)
let screen = screenFrame(window)

switch command {
case "ui":
    for node in screenNodes(window) {
        print("\(node.role.replacingOccurrences(of: "AX", with: "")) [\(Int(node.frame.midX)),\(Int(node.frame.midY))] \(node.label)")
    }
case "tap":
    guard args.count >= 2 else { fail("tap needs a label") }
    let query = args[1].lowercased()
    let index = args.count > 2 ? Int(args[2]) ?? 0 : 0
    let exact = screenNodes(window).filter { $0.label.lowercased().split(separator: "¦").contains { $0.trimmingCharacters(in: .whitespaces) == query } }
    let matches = exact.isEmpty ? screenNodes(window).filter { $0.label.lowercased().contains(query) } : exact
    guard index < matches.count else { fail("no element #\(index) labelled \"\(args[1])\". Run `sim ui` to list labels.") }
    click(window, center(matches[index].frame))
case "tapxy":
    guard args.count == 3, let x = Double(args[1]), let y = Double(args[2]) else { fail("tapxy needs screen x y from `sim ui`") }
    click(window, CGPoint(x: x, y: y))
case "tapfrac":
    guard args.count == 3, let fx = Double(args[1]), let fy = Double(args[2]) else {
        fail("tapfrac needs fractions of the screen, e.g. a screenshot pixel divided by the screenshot size")
    }
    click(window, CGPoint(x: screen.minX + screen.width * fx, y: screen.minY + screen.height * fy))
case "swipe":
    let c = center(screen), dx = screen.width * 0.35, dy = screen.height * 0.3
    let (from, to): (CGPoint, CGPoint) = switch args.count > 1 ? args[1] : "" {
    case "up": (CGPoint(x: c.x, y: c.y + dy), CGPoint(x: c.x, y: c.y - dy))
    // Starts near the top so a downward swipe also dismisses sheets.
    case "down": (CGPoint(x: c.x, y: screen.minY + 60), CGPoint(x: c.x, y: screen.maxY - 60))
    case "left": (CGPoint(x: c.x + dx, y: c.y), CGPoint(x: c.x - dx, y: c.y))
    case "right": (CGPoint(x: c.x - dx, y: c.y), CGPoint(x: c.x + dx, y: c.y))
    default: fail("swipe up|down|left|right")
    }
    drag(window, from: from, to: to)
case "type":
    guard args.count == 2 else { fail("type needs one quoted string") }
    type(window, args[1])
default:
    fail("unknown command \(command)")
}
