// Drives the MacroFactor window with synthesized CGEvents.
// Coordinates are in the 1000-px-tall JPEG produced by `mf shot`, so they scale by window height / 1000.
// Usage: mfinput <mode> click x y | dclick x y | long x y | scroll x y dy | hscroll x y dx | drag x1 y1 x2 y2 | type text | key code [cmd|shift|...]
// mode: pid (CGEvent.postToPid, cursor untouched) or hid (.cghidEventTap, moves the real cursor)
import AppKit
import CoreGraphics
import Foundation

func window() -> (pid: pid_t, frame: CGRect, number: Int64) {
    let list = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as! [[String: Any]]
    for w in list where (w["kCGWindowName"] as? String) == "MacroFactor" && (w["kCGWindowLayer"] as? Int) == 0 {
        let b = w["kCGWindowBounds"] as! [String: CGFloat]
        return (w["kCGWindowOwnerPID"] as! pid_t, CGRect(x: b["X"]!, y: b["Y"]!, width: b["Width"]!, height: b["Height"]!), Int64(w["kCGWindowNumber"] as! Int))
    }
    fatalError("MacroFactor window not found")
}

var args = Array(CommandLine.arguments.dropFirst())
let mode = args.removeFirst()
let cmd = args.removeFirst()
let (pid, frame, windowNumber) = window()
let scale = frame.height / 1000
// HID events land on whatever window is under the point, so refuse to post unless MacroFactor is frontmost.
// The owner may be working in another app, so hand focus back to it afterwards.
// NSRunningApplication.activate() is ignored for a CLI caller under cooperative activation; System Events is not.
func bringToFront(_ target: pid_t) {
    let p = Process()
    p.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
    p.arguments = ["-e", "tell application \"System Events\" to set frontmost of (first process whose unix id is \(target)) to true"]
    try? p.run()
    p.waitUntilExit()
}
let previous = NSWorkspace.shared.frontmostApplication
if mode == "hid" {
    if previous?.processIdentifier != pid { bringToFront(pid) }
    for _ in 0..<20 where NSWorkspace.shared.frontmostApplication?.processIdentifier != pid { usleep(100_000) }
    guard NSWorkspace.shared.frontmostApplication?.processIdentifier == pid else {
        FileHandle.standardError.write("MacroFactor is not frontmost; no events posted\n".data(using: .utf8)!)
        exit(3)
    }
}
let home = CGEvent(source: nil)!.location
defer {
    if mode == "hid" {
        usleep(50_000)
        CGWarpMouseCursorPosition(home)
        if let previous, previous.processIdentifier != pid { bringToFront(previous.processIdentifier) }
    }
}
func pt(_ x: String, _ y: String) -> CGPoint {
    CGPoint(x: frame.minX + CGFloat(Double(x)!) * scale, y: frame.minY + CGFloat(Double(y)!) * scale)
}
func post(_ e: CGEvent) {
    if mode == "pid" {
        // Window-under-pointer fields let a backgrounded app accept the event as if it were hit-tested.
        e.setIntegerValueField(CGEventField(rawValue: 91)!, value: windowNumber)
        e.setIntegerValueField(CGEventField(rawValue: 92)!, value: windowNumber)
        e.postToPid(pid)
    } else { e.post(tap: .cghidEventTap) }
}
func mouse(_ type: CGEventType, _ p: CGPoint, clicks: Int64 = 1) {
    let e = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: p, mouseButton: .left)!
    e.setIntegerValueField(.mouseEventClickState, value: clicks)
    post(e)
}
func click(_ p: CGPoint, hold: useconds_t = 60_000, clicks: Int64 = 1) {
    mouse(.mouseMoved, p)
    usleep(30_000)
    mouse(.leftMouseDown, p, clicks: clicks)
    usleep(hold)
    mouse(.leftMouseUp, p, clicks: clicks)
}

switch cmd {
case "click":
    click(pt(args[0], args[1]))
case "dclick":
    let p = pt(args[0], args[1])
    click(p); usleep(80_000); click(p, clicks: 2)
case "long":
    click(pt(args[0], args[1]), hold: 900_000)
case "scroll", "hscroll":
    let p = pt(args[0], args[1])
    mouse(.mouseMoved, p)
    usleep(30_000)
    let total = Int32(args[2])!
    let steps = max(1, abs(Int(total)) / 20)
    for _ in 0..<steps {
        let e = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 2, wheel1: cmd == "scroll" ? total / Int32(steps) : 0,
                        wheel2: cmd == "hscroll" ? total / Int32(steps) : 0, wheel3: 0)!
        e.location = p
        // Flutter maps shift + vertical wheel to horizontal scrolling.
        if cmd == "hscroll" { e.flags = .maskShift; e.setIntegerValueField(.scrollWheelEventDeltaAxis1, value: Int64(total / Int32(steps)) / 10) }
        post(e)
        usleep(16_000)
    }
case "drag":
    let a = pt(args[0], args[1]), b = pt(args[2], args[3])
    mouse(.mouseMoved, a)
    mouse(.leftMouseDown, a)
    usleep(100_000)
    for i in 1...20 {
        let t = CGFloat(i) / 20
        mouse(.leftMouseDragged, CGPoint(x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t))
        usleep(16_000)
    }
    usleep(100_000)
    mouse(.leftMouseUp, b)
case "type":
    // Numeric-only fields filter on the key code, so digits and "." go out as real keys.
    let digitKeys: [Character: CGKeyCode] = ["0": 29, "1": 18, "2": 19, "3": 20, "4": 21, "5": 23, "6": 22, "7": 26, "8": 28, "9": 25, ".": 47]
    for ch in args.joined(separator: " ") {
        for down in [true, false] {
            let e = CGEvent(keyboardEventSource: nil, virtualKey: digitKeys[ch] ?? 0, keyDown: down)!
            if digitKeys[ch] == nil {
                var units = Array(String(ch).utf16)
                e.keyboardSetUnicodeString(stringLength: units.count, unicodeString: &units)
            }
            post(e)
            usleep(15_000)
        }
    }
case "key":
    let code = CGKeyCode(args[0])!
    var flags: CGEventFlags = []
    for m in args.dropFirst() {
        switch m {
        case "cmd": flags.insert(.maskCommand)
        case "shift": flags.insert(.maskShift)
        case "alt": flags.insert(.maskAlternate)
        case "ctrl": flags.insert(.maskControl)
        default: break
        }
    }
    for down in [true, false] {
        let e = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: down)!
        e.flags = flags
        post(e)
        usleep(20_000)
    }
default:
    fatalError("unknown command \(cmd)")
}
