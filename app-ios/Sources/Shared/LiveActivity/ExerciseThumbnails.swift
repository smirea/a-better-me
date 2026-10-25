import Foundation

/// Exercise frames the app copies into the app group, since the widget extension can't read the app's bundle and
/// ActivityKit's 4 KB content state can't carry an image.
enum ExerciseThumbnails {
    static let appGroup = "group.com.stefan.a-better-me"
    static let pixelSize = 120

    static func url(for catalogID: String) -> URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)?
            .appending(path: "Thumbnails/\(catalogID).jpg")
    }
}
