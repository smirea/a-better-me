#if DEBUG
import Foundation
import GRDB

/// The dev seed's (`DevSeed`) active program and nutrition history.
enum DashboardSeed {
    /// Turns the sample Upper and Lower templates into an active program and files this week's sample sessions under
    /// its first cycle, so the Cycle Workouts rings have a plan and progress.
    static func insertProgram(in db: Database) throws {
        let templates = try WorkoutTemplate.fetchAll(db)
        guard let upper = templates.first(where: { $0.id == DevSeed.id("template/Upper") }),
              let lower = templates.first(where: { $0.id == DevSeed.id("template/Lower") }) else { return }
        var days = [ProgramDay(templateID: upper.id), ProgramDay(templateID: lower.id), ProgramDay(), ProgramDay(templateID: upper.id)]
        for index in days.indices { days[index].id = DevSeed.id("program/day/\(index)") }
        var program = Program(name: "Upper Lower", color: .blue, cycles: 4, days: days)
        program.id = DevSeed.id("program")
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

    /// 45 days of weigh-ins, quick adds before the Food Log's own six days, a losing plan, imported steps, and one
    /// fasted, one incomplete, and one entered day, so the nutrition cards and details have data.
    static func insertNutrition(in db: Database) throws {
        let today = CalendarDay.today
        let calendar = Calendar.current
        for offset in 0..<45 {
            let day = today.adding(days: -offset)
            let date = day.date(in: calendar)
            if offset % 5 != 2 {
                let kg = 84 - Double(45 - offset) * 0.045 + sin(Double(offset) * 1.3) * 0.5
                var weighIn = BodyWeight(weightKg: (kg * 10).rounded() / 10, measuredAt: min(date.addingTimeInterval(7.5 * 3600), .now.addingTimeInterval(-60)))
                weighIn.id = DevSeed.id("weigh-in/\(offset)")
                try weighIn.insert(db)
            }
            if offset >= 20 {
                try BodyMetric(.steps, on: day, value: Double(6000 + (offset * 1931) % 7000)).insert(db)
            }
            guard offset >= FoodLogSeed.days.count else { continue }
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
            case 7:
                var row = NutritionDay(id: day)
                row.status = .partial
                try row.insert(db)
            default:
                if offset % 9 == 4 { continue }
            }
            let kcal = 2050 + Double((offset * 137) % 400) - 200
            for (meal, (minute, share)) in [(480, 0.25), (780, 0.35), (1140, 0.4)].enumerated() {
                let amounts: NutrientAmounts = [.energy: kcal * share, .protein: kcal * share * 0.3 / 4, .fat: kcal * share * 0.3 / 9, .carbs: kcal * share * 0.4 / 4]
                var entry = FoodEntry(FoodPortion(.quickAdd(amounts)), day: day, minute: minute)
                entry.id = DevSeed.id("quick-add/\(offset)/\(meal)")
                try entry.insert(db)
            }
        }
        let start = today.adding(days: -40)
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
#endif
