import Foundation
import HealthKit
import os

/// A day's sleep from Apple Health, as the markers the Pings timeline draws. It is read when the tab shows the day and
/// kept only in memory: unlike weigh-ins and steps, nothing else reads sleep yet, so it is not copied into the database.
@MainActor @Observable
final class SleepLog {
    static let type = HKCategoryType(.sleepAnalysis)

    private(set) var markers: [CalendarDay: [TimelineMarker]] = [:]

    private static let log = Logger(subsystem: "com.stefan.a-better-me", category: "health")

    func load(_ day: CalendarDay) async {
        guard HealthStore.isAvailable else { return }
        let calendar = Calendar.current
        // A night that ends on the day began the day before, and the day's bedtime can be early the next morning, with a
        // sample after it that is still the same sleep.
        let from = day.adding(days: -1).date(in: calendar)
        let through = day.adding(days: 1).date(in: calendar)
            .addingTimeInterval(TimeInterval(SleepSession.nightEndsHour) * 3600 + SleepSession.maxGap)
        let query = HKSampleQueryDescriptor(
            predicates: [.categorySample(type: Self.type, predicate: HKQuery.predicateForSamples(withStart: from, end: through))],
            sortDescriptors: [SortDescriptor(\.startDate)]
        )
        do {
            let asleep = Set(HKCategoryValueSleepAnalysis.allAsleepValues.map(\.rawValue))
            let samples = try await query.result(for: HealthStore.shared).filter { asleep.contains($0.value) }
            let found = SleepSession.sessions(samples.map { DateInterval(start: $0.startDate, end: $0.endDate) })
                .flatMap { $0.markers(on: day, calendar: calendar) }
            if markers[day] != found { markers[day] = found }
        } catch {
            Self.log.error("Reading sleep failed: \(String(describing: error))")
        }
    }
}
