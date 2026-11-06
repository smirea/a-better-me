#if DEBUG
import Foundation
import GRDB

/// The dev seed's (`DevSeed`) active program and nutrition history.
enum DashboardSeed {
    /// Gives the sample Upper and Lower templates program-owned copies, makes those an active program, and files this
    /// week's sample sessions under its first cycle, so the Cycle Workouts rings have a plan and progress. A second,
    /// inactive program gives the Workout Library a program card without deactivating the first.
    static func insertProgram(in db: Database) throws {
        let library = try WorkoutTemplate.fetchAll(db)
        guard let program = try insertProgram(
            "Upper Lower", id: "program", color: .blue, cycles: 4, days: ["Upper", "Lower", nil, "Upper"], isActive: true,
            library: library, in: db
        ) else { return }
        _ = try insertProgram(
            "Upper Lower Lite", id: "program/lite", color: .green, cycles: 3, days: ["Upper", nil, "Lower"], isActive: false,
            library: library, in: db
        )
        let calendar = Calendar.current
        for session in try WorkoutSession.fetchAll(db) where calendar.isDate(session.startedAt, equalTo: .now, toGranularity: .weekOfYear) {
            var filed = session
            let day = session.name == "Lower" ? program.days[1] : program.days[0]
            filed.program = ProgramPosition(programID: program.id, dayID: day.id, cycle: 1)
            try filed.updateChanges(db, from: session)
        }
    }

    /// A program whose days open its own copies of the named library templates, `nil` for a rest day. Nil when the
    /// library lacks one of them.
    private static func insertProgram(
        _ name: String, id: String, color: ProgramColor, cycles: Int, days layout: [String?], isActive: Bool,
        library: [WorkoutTemplate], in db: Database
    ) throws -> Program? {
        var program = Program(name: name, color: color, cycles: cycles)
        program.id = DevSeed.id(id)
        program.isActive = isActive
        var owned: [String: WorkoutTemplate] = [:]
        for templateName in layout.compactMap({ $0 }) where owned[templateName] == nil {
            guard let source = library.first(where: { $0.id == DevSeed.id("template/\(templateName)") }) else { return nil }
            var template = WorkoutTemplate(name: source.name, blocks: source.blocks.copyingCycleTargets())
            template.id = DevSeed.id("\(id)/template/\(templateName)")
            template.programID = program.id
            owned[templateName] = template
        }
        for template in owned.values { try template.insert(db) }
        program.days = layout.enumerated().map { index, templateName in
            var day = ProgramDay(templateID: templateName.flatMap { owned[$0]?.id })
            day.id = DevSeed.id("\(id)/day/\(index)")
            return day
        }
        try program.insert(db)
        return program
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
