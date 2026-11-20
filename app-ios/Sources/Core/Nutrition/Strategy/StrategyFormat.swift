import Foundation

enum StrategyFormat {
    static let weekdayLetters = ["M", "T", "W", "T", "F", "S", "S"]
    static let weekdayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    static func day(_ day: CalendarDay, year: Bool = false) -> String {
        year ? day.date.formatted(.dateTime.month(.abbreviated).day().year()) : NutritionFormat.shortDay(day)
    }

    static func range(_ start: CalendarDay, _ end: CalendarDay?) -> String {
        "\(day(start, year: true)) – \(end.map { day($0, year: true) } ?? "Now")"
    }

    static func kcal(_ value: Double) -> String { "\(value.wholeText) cal" }

    static func weight(_ kg: Double?, _ unit: WeightUnit) -> String {
        kg.map { "\(unit.fromKg($0).formatted(.number.precision(.fractionLength(1)))) \(unit.rawValue)" } ?? "—"
    }

    static func signed(_ value: Double, digits: ClosedRange<Int>) -> String {
        value.formatted(.number.precision(.fractionLength(digits)).sign(strategy: .always()))
    }
}
