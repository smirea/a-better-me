import Foundation
import Testing
@testable import App

struct WeighInsTests {
    @Test func mergeKeepsTheAppRowWhenHealthHasTheSameMoment() {
        let logged = BodyWeight(weightKg: 81.2, measuredAt: day("2026-10-02"))
        let health = [
            HealthWeight(date: day("2026-10-02").addingTimeInterval(30), kg: 81.25),
            HealthWeight(date: day("2026-10-01"), kg: 81.9),
            HealthWeight(date: day("2026-10-02").addingTimeInterval(3600), kg: 80.8),
        ]
        let merged = WeighIns.merge(logged: [logged], health: health)
        #expect(merged.map(\.kg) == [81.9, 81.2, 80.8])
        #expect(merged.map(\.source) == [.health, .app(logged.id), .health])
    }


    @Test func mergeMatchesEachHealthSampleAgainstTheNearestAppRowInAnyOrder() {
        let newestFirst = [
            BodyWeight(weightKg: 80, measuredAt: day("2026-10-05")),
            BodyWeight(weightKg: 81, measuredAt: day("2026-10-03")),
            BodyWeight(weightKg: 82, measuredAt: day("2026-10-01")),
        ]
        let health = [
            HealthWeight(date: day("2026-10-05").addingTimeInterval(-59), kg: 80.1),
            HealthWeight(date: day("2026-10-04"), kg: 80.6),
            HealthWeight(date: day("2026-10-01").addingTimeInterval(60), kg: 82.1),
            HealthWeight(date: day("2026-10-03").addingTimeInterval(10), kg: 81.1),
        ]
        let merged = WeighIns.merge(logged: newestFirst, health: health)
        #expect(merged.map(\.kg) == [82, 82.1, 81, 80.6, 80])
    }
}

struct WeightTrendDaylightSavingTests {
}
