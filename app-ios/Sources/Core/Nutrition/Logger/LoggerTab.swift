import Foundation

enum LoggerTab: String, CaseIterable, Hashable, Sendable {
    case scan, photo, ramble, search, quickAdd, library

    var title: String {
        switch self {
        case .scan: "Scan"
        case .photo: "Photo"
        case .ramble: "Ramble"
        case .search: "Search"
        case .quickAdd: "Quick Add"
        case .library: "Library"
        }
    }

    /// The segment's label: six full titles don't fit a phone's width, and "Quick Add" truncated to "Quick…".
    var segment: String { self == .quickAdd ? "Quick" : title }

    var systemImage: String {
        switch self {
        case .scan: "barcode.viewfinder"
        case .photo: "camera"
        case .ramble: "waveform"
        case .search: "magnifyingglass"
        case .quickAdd: "bolt"
        case .library: "books.vertical"
        }
    }
}

/// How the logger opens: the tab its shortcut names and, from an hour's or a section's + in the Food Log, that day and
/// time.
struct LoggerStart: Hashable, Identifiable, Sendable {
    var tab = LoggerTab.search
    /// The Library segment a quick action names; otherwise the Library opens on the one last chosen.
    var library: FoodLibraryTab?
    var time: LogTime?

    var id: Self { self }
}

extension LoggerStart {
    /// The Food Log's request: its tab, and the hour or section whose + asked. A request for today without either follows
    /// the clock; another day logs at the current hour of that day.
    init(_ request: LogFoodRequest, now: Date = .now, calendar: Calendar = .current) {
        tab = request.start
        if let minute = request.minute {
            time = LogTime(day: request.day, hour: minute / 60, section: request.section)
        } else if request.day != CalendarDay(now, in: calendar) {
            time = LogTime(day: request.day, hour: calendar.component(.hour, from: now))
        }
    }
}

extension NutritionSettings.Logger.NutritionDisplay {
    var page: MacroLine.Page {
        switch self {
        case .plateOnly: .plate
        case .dayAndPlate: .eaten
        case .remainingAfterPlate: .remaining
        }
    }
}
