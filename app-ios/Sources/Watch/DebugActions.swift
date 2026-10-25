import SwiftUI

/// Debug builds only: no tool can tap a watch simulator, so each named control also answers the Darwin notification
/// `com.stefan.a-better-me.watch.<name>`, posted with
/// `xcrun simctl spawn <watch> notifyutil -p com.stefan.a-better-me.watch.check`. It runs the control's own action.
enum DebugAction: String, CaseIterable {
    case check, crownUp, crownDown, nextField, restLess, restMore, skipRest
    case pageControls, pageMain, pageStats, pause, resume, end, start, done, exercises

    static let prefix = "com.stefan.a-better-me.watch."
    static let notification = Notification.Name("WatchDebugAction")

    #if DEBUG
    static func register() {
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        for action in allCases {
            CFNotificationCenterAddObserver(center, nil, { _, _, name, _, _ in
                guard let name = name?.rawValue as String?, let action = DebugAction(rawValue: String(name.dropFirst(DebugAction.prefix.count))) else { return }
                Task { @MainActor in NotificationCenter.default.post(name: DebugAction.notification, object: action.rawValue) }
            }, (prefix + action.rawValue) as CFString, nil, .deliverImmediately)
        }
    }
    #endif
}

extension View {
    func onDebugAction(_ action: DebugAction, perform: @escaping () -> Void) -> some View {
        #if DEBUG
        onReceive(NotificationCenter.default.publisher(for: DebugAction.notification)) { note in
            if note.object as? String == action.rawValue { perform() }
        }
        #else
        self
        #endif
    }
}
