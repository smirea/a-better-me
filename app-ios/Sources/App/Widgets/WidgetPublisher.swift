import GRDB
import os
import UIKit
import WidgetKit

/// Keeps the widgets' snapshots current. One observation over the log, the plans, the goals, and the settings rebuilds
/// the nutrition snapshot off the main thread; the steps snapshot joins Health's days, which `HealthData` hands over,
/// with the imported days and the goal. A changed snapshot is written to the app group and reloads its widgets.
@MainActor
final class WidgetPublisher {
    static let shared = WidgetPublisher()
    nonisolated private static let log = Logger(subsystem: "com.stefan.a-better-me", category: "widgets")

    private var store: LocalStore?
    private var observation: AnyDatabaseCancellable?
    private var activation: (any NSObjectProtocol)?
    private var published: NutritionSnapshot?
    private var stepsObservation: AnyDatabaseCancellable?
    private var stepInputs: StepInputs?
    /// Nil until Health answers, so a launch that never reads it (in the background, or locked) keeps the last file.
    private var healthSteps: [DatedValue]?
    private var publishedSteps: StepsSnapshot?
    private var writing: Task<Void, Never>?

    func start(store: LocalStore) {
        guard self.store == nil else { return }
        self.store = store
        observe()
        // The snapshot starts on the day it was read, and a new day changes no table, so each activation reads again.
        activation = NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.observe() }
        }
    }

    private func observe() {
        guard let store else { return }
        observation = ValueObservation.tracking { try Self.snapshot($0, today: .today) }.removeDuplicates().start(
            in: store.database.pool,
            onError: { Self.log.error("Observing the widget snapshot failed: \(String(describing: $0))") },
            onChange: { [weak self] in self?.publish($0) }
        )
        stepsObservation = ValueObservation.tracking { try StepInputs($0) }.removeDuplicates().start(
            in: store.database.pool,
            onError: { Self.log.error("Observing the steps snapshot failed: \(String(describing: $0))") },
            onChange: { [weak self] in
                self?.stepInputs = $0
                self?.publishSteps()
            }
        )
    }

    func update(healthSteps: [DatedValue]) {
        self.healthSteps = healthSteps
        publishSteps()
    }

    private func publishSteps() {
        guard let stepInputs, let healthSteps else { return }
        let steps = NutritionMetrics.steps(health: healthSteps, imported: stepInputs.imported, calendar: .current)
        let snapshot = StepsSnapshot(goal: stepInputs.goal, steps: steps)
        guard snapshot != publishedSteps else { return }
        publishedSteps = snapshot
        write(kinds: WidgetKind.allSteps) { try snapshot.save() }
    }

    private func publish(_ snapshot: NutritionSnapshot) {
        guard snapshot != published else { return }
        published = snapshot
        write(kinds: WidgetKind.nutrition) { try snapshot.save() }
    }

    private func write(kinds: [String], _ save: @escaping @Sendable () throws -> Void) {
        let previous = writing
        writing = Task.detached(priority: .utility) {
            // Chained, so a slow write can't land after a newer one and leave stale totals on disk.
            await previous?.value
            do {
                try save()
                for kind in kinds { WidgetCenter.shared.reloadTimelines(ofKind: kind) }
            } catch {
                Self.log.error("Writing a widget snapshot failed: \(String(describing: error))")
            }
        }
    }

    nonisolated static func snapshot(_ db: Database, today: CalendarDay) throws -> NutritionSnapshot {
        let last = today.adding(days: NutritionSnapshot.horizon - 1)
        let settings = try AppSettings.current.fetch(db)
        let plans = try NutritionPlan.all.fetch(db)
        let goals = try NutrientGoal.all.fetch(db)
        let weightKg = try BodyWeight.latest.fetch(db)?.weightKg ?? settings.profile.bodyWeightKg
        let entries = Dictionary(grouping: try FoodEntry.between(today, last).fetch(db), by: \.day)
        let rows = Dictionary(uniqueKeysWithValues: try NutritionDay.between(today, last).fetch(db).map { ($0.id, $0) })

        let hidden = settings.nutrition.hiddenNutrients
        let nutrients = NutrientRegistry.all.filter { NutrientID.macros.contains($0.id) || !hidden.contains($0.id) }
        let days = (0..<NutritionSnapshot.horizon).map { offset in
            let day = today.adding(days: offset)
            let totals = (rows[day] ?? NutritionDay(id: day)).totals(entries[day] ?? [])
            let targets = NutrientTargets(
                target: NutritionPlan.effective(on: day, in: plans)?.target(on: day), goals: goals, day: day,
                sex: settings.profile.sex, weightKg: weightKg
            )
            var consumed: [String: Double] = [:]
            var ranges: [String: NutritionSnapshot.Range] = [:]
            for nutrient in nutrients {
                consumed[nutrient.id.rawValue] = totals.amount(of: nutrient.id)
                let range = targets.range(nutrient.id)
                if range != NutrientRange() {
                    ranges[nutrient.id.rawValue] = NutritionSnapshot.Range(floor: range.floor, target: range.target, ceiling: range.ceiling)
                }
            }
            return NutritionSnapshot.Day(day: day.description, consumed: consumed, ranges: ranges)
        }
        return NutritionSnapshot(
            nutrients: nutrients.map { NutritionSnapshot.Nutrient(id: $0.id.rawValue, name: $0.name, short: $0.short, unit: $0.unit.rawValue, tint: $0.tint) },
            pinned: settings.nutrition.pinnedNutrients.filter { !hidden.contains($0) || NutrientID.macros.contains($0) }.map(\.rawValue),
            showOverages: settings.nutrition.showOverages,
            days: days
        )
    }
}

/// What the steps snapshot reads from the database: the goal and the steps imported from MacroFactor.
private struct StepInputs: Equatable {
    let goal: Int
    let imported: [BodyMetric]

    init(_ db: Database) throws {
        goal = try AppSettings.current.fetch(db).profile.dailyStepGoal
        imported = try BodyMetric.series(.steps).fetch(db)
    }
}
