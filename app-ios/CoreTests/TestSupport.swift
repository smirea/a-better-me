import Foundation
@testable import Core

/// UTC with Monday first, the calendar date-based suites compute in.
let utc: Calendar = {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "UTC")!
    calendar.firstWeekday = 2
    return calendar
}()

/// 8 AM UTC on a `YYYY-MM-DD` day.
func day(_ text: String, _ hour: Int = 8) -> Date {
    let parts = text.split(separator: "-").map { Int($0)! }
    return utc.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: hour))!
}

typealias Engine = NutritionEngine

