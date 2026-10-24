import Foundation

struct DatedValue: Hashable {
    var date: Date
    var value: Double
}

enum ChartRange: String, CaseIterable, Identifiable {
    case oneWeek = "1W", oneMonth = "1M", threeMonths = "3M", sixMonths = "6M", oneYear = "1Y", all = "All"

    var id: Self { self }

    /// 1W is today and the six days before it, as in the reference ("Oct 17 - 23").
    func interval(endingAt now: Date, earliest: Date?, calendar: Calendar) -> DateInterval {
        let end = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))!
        let today = calendar.startOfDay(for: now)
        let start: Date = switch self {
        case .oneWeek: calendar.date(byAdding: .day, value: -6, to: today)!
        case .oneMonth: calendar.date(byAdding: .month, value: -1, to: end)!
        case .threeMonths: calendar.date(byAdding: .month, value: -3, to: end)!
        case .sixMonths: calendar.date(byAdding: .month, value: -6, to: end)!
        case .oneYear: calendar.date(byAdding: .year, value: -1, to: end)!
        case .all: earliest.map { min(calendar.startOfDay(for: $0), calendar.date(byAdding: .day, value: -6, to: today)!) }
            ?? calendar.date(byAdding: .day, value: -6, to: today)!
        }
        return DateInterval(start: start, end: end)
    }
}

/// W and M average only the days that have data, not every calendar day in the bucket.
enum Averaging: String, CaseIterable, Identifiable {
    case daily = "D", weekly = "W", monthly = "M"

    var id: Self { self }

    var title: String {
        switch self {
        case .daily: "D - Daily"
        case .weekly: "W - Weekly"
        case .monthly: "M - Monthly"
        }
    }

    var component: Calendar.Component {
        switch self {
        case .daily: .day
        case .weekly: .weekOfYear
        case .monthly: .month
        }
    }

    func bucket(_ points: [DatedValue], calendar: Calendar) -> [DatedValue] {
        let groups = Dictionary(grouping: points) { calendar.dateInterval(of: component, for: $0.date)!.start }
        return groups.map { start, values in
            DatedValue(date: start, value: values.map(\.value).reduce(0, +) / Double(values.count))
        }
        .sorted { $0.date < $1.date }
    }
}

enum DailyCombine {
    case sum, max, mean

    func combine(_ points: [DatedValue], calendar: Calendar) -> [DatedValue] {
        let days = Dictionary(grouping: points) { calendar.startOfDay(for: $0.date) }
        return days.map { day, values in
            let numbers = values.map(\.value)
            let value = switch self {
            case .sum: numbers.reduce(0, +)
            case .max: numbers.max()!
            case .mean: numbers.reduce(0, +) / Double(numbers.count)
            }
            return DatedValue(date: day, value: value)
        }
        .sorted { $0.date < $1.date }
    }
}

enum SummaryKind {
    case total, best, change

    func second(of values: [Double]) -> Double? {
        guard let last = values.last else { return nil }
        return switch self {
        case .total: values.reduce(0, +)
        case .best: values.max()
        case .change: last - values[0]
        }
    }

    func title(_ metric: String) -> String {
        switch self {
        case .total: "Total \(metric)"
        case .best: "Best \(metric)"
        case .change: "Change"
        }
    }
}

extension [DatedValue] {
    func inside(_ interval: DateInterval) -> [DatedValue] {
        filter { $0.date >= interval.start && $0.date < interval.end }
    }

    var average: Double? { isEmpty ? nil : map(\.value).reduce(0, +) / Double(count) }
}
