import Foundation

/// The container the app shares with the widget extension, for what the widgets draw that they can't compute.
enum AppGroup {
    static let id = "group.com.stefan.a-better-me"

    static func url(_ path: String) -> URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id)?.appending(path: path)
    }
}

/// Widget kinds, shared so the app reloads exactly the widgets a write changes.
enum WidgetKind {
    static let currentAndRemaining = "nutrition.currentAndRemaining"
    static let nutrientFocus = "nutrition.nutrientFocus"
    static let nutrientCollection = "nutrition.nutrientCollection"
    static let nutrition = [currentAndRemaining, nutrientFocus, nutrientCollection]
    static let quickActions = "quickActions"
    static let quickActionControl = "quickActionControl"
}
