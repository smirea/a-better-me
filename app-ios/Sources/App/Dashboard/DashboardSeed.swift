#if DEBUG
import Foundation
import GRDB

/// Launch with `-seedActiveProgram` after `-seedSampleData` to turn the sample Upper and Lower templates into an
/// active program and file this week's sample sessions under its first cycle, so the Cycle Workouts rings have a plan
/// and progress. It does nothing once a program exists.
enum DashboardSeed {
    static let launchArgument = "-seedActiveProgram"
    /// Fills an empty food log with 75 days of quick adds, weigh-ins, a losing plan, imported steps, and one fasted,
    /// one incomplete, and one entered day, so the nutrition cards and details have data. Food Log has its own seed.
    static let nutritionArgument = "-seedNutritionDashboard"

    @MainActor
    static func seedIfRequested(_ store: LocalStore) {
        if ProcessInfo.processInfo.arguments.contains(nutritionArgument) { seedNutrition(store) }
        guard ProcessInfo.processInfo.arguments.contains(launchArgument) else { return }
        store.write { db in
            guard try Program.fetchCount(db) == 0 else { return }
            let templates = try WorkoutTemplate.fetchAll(db).sorted { $0.createdAt < $1.createdAt }
            guard templates.count >= 2 else { return }
            let days = [ProgramDay(templateID: templates[0].id), ProgramDay(templateID: templates[1].id), ProgramDay(), ProgramDay(templateID: templates[0].id)]
            var program = Program(name: "Upper Lower", color: .blue, cycles: 4, days: days)
            program.isActive = true
            try program.insert(db)
            let calendar = Calendar.current
            for session in try WorkoutSession.fetchAll(db) where calendar.isDate(session.startedAt, equalTo: .now, toGranularity: .weekOfYear) {
                var filed = session
                let day = days.first { $0.templateID == session.templateID } ?? days[0]
                filed.program = ProgramPosition(programID: program.id, dayID: day.id, cycle: 1)
                try filed.updateChanges(db, from: session)
            }
        }
    }

    @MainActor
    private static func seedNutrition(_ store: LocalStore) {
        store.write { db in
            guard try FoodEntry.fetchCount(db) == 0 else { return }
            let today = CalendarDay.today
            let calendar = Calendar.current
            for offset in 0..<75 {
                let day = today.adding(days: -offset)
                let date = day.date(in: calendar)
                if offset % 5 != 2 {
                    let kg = 84 - Double(75 - offset) * 0.045 + sin(Double(offset) * 1.3) * 0.5
                    try BodyWeight(weightKg: (kg * 10).rounded() / 10, measuredAt: min(date.addingTimeInterval(7.5 * 3600), .now.addingTimeInterval(-60))).insert(db)
                }
                if offset >= 40 {
                    try BodyMetric(.steps, on: day, value: Double(6000 + (offset * 1931) % 7000)).insert(db)
                }
                switch offset {
                case 12:
                    var row = NutritionDay(id: day)
                    row.status = .fasted
                    try row.insert(db)
                    continue
                case 18:
                    var row = NutritionDay(id: day)
                    row.override = [.energy: 2350, .protein: 150, .fat: 80, .carbs: 240]
                    try row.insert(db)
                    continue
                case 6:
                    var row = NutritionDay(id: day)
                    row.status = .partial
                    try row.insert(db)
                default:
                    if offset % 9 == 4 { continue }
                }
                let meals = offset == 0 ? [(480, 0.25)] : [(480, 0.25), (780, 0.35), (1140, 0.4)]
                let kcal = 2050 + Double((offset * 137) % 400) - 200
                for (minute, share) in meals {
                    let amounts: NutrientAmounts = [.energy: kcal * share, .protein: kcal * share * 0.3 / 4, .fat: kcal * share * 0.3 / 9, .carbs: kcal * share * 0.4 / 4]
                    try FoodEntry(FoodPortion(.quickAdd(amounts)), day: day, minute: minute).insert(db)
                }
            }
            let start = today.adding(days: -60)
            try NutritionPlan(
                from: start, kind: .setup,
                goal: NutritionGoal(kind: .lose, targetWeightKg: 78, ratePercentPerWeek: -0.5, startedOn: start),
                coaching: CoachingProgram(), targets: WeekTargets(every: DayTarget(energy: 2100, protein: 160, fat: 65, carbs: 210))
            ).insert(db)
            var settings = try AppSettings.current.fetch(db)
            if settings.profile.heightCm == nil { settings.profile.heightCm = 180 }
            if settings.profile.birthDate == nil { settings.profile.birthDate = CalendarDay("1990-06-01") }
            try LocalStore.put(settings, in: db)
        }
    }
}
#endif
