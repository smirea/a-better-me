import GRDB
import os
import UIKit
import WidgetKit

/// Keeps the widgets' snapshots current. One observation over the log, the plans, the goals, and the settings rebuilds
/// the nutrition snapshot off the main thread; the steps snapshot joins Health's days, read from `HealthData`,
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
    private var publishedSteps: StepSources?
    private var writing: Task<Void, Never>?
    private var workoutReloads: Task<Void, Never>?

    func start(store: LocalStore, health: HealthData) {
        guard self.store == nil else { return }
        self.store = store
        observe()
        trackHealth(health)
        // The snapshot starts on the day it was read, and a new day changes no table, so each activation reads again.
        activation = NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.observe() }
        }
        trackWorkout()
    }

    /// A live workout keeps the app running, so it reloads the step widgets on the moving cadence. On its own a widget
    /// learns the owner is moving only from steps it already counted, and a gym session counts few.
    private func trackWorkout() {
        let live = withObservationTracking { LiveWorkoutController.shared.status != nil } onChange: { [weak self] in
            Task { @MainActor in self?.trackWorkout() }
        }
        guard live else {
            workoutReloads?.cancel()
            workoutReloads = nil
            return
        }
        guard workoutReloads == nil else { return }
        workoutReloads = Task {
            while (try? await Task.sleep(for: .seconds(StepsCadence.moving))) != nil {
                for kind in WidgetKind.allSteps { WidgetCenter.shared.reloadTimelines(ofKind: kind) }
            }
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

    private func trackHealth(_ health: HealthData) {
        healthSteps = withObservationTracking { health.hasRead ? health.steps : nil } onChange: { [weak self] in
            Task { @MainActor in self?.trackHealth(health) }
        }
        publishSteps()
    }

    private func publishSteps() {
        guard let stepInputs, let healthSteps else { return }
        let sources = StepSources(health: healthSteps, inputs: stepInputs)
        guard sources != publishedSteps else { return }
        publishedSteps = sources
        // Merging and keying years of days is data work, so it runs in the write's task.
        write(kinds: WidgetKind.allSteps) { try sources.snapshot().save() }
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
        let latestWeightKg = try BodyWeight.latest.fetch(db)?.weightKg
        let entries = Dictionary(grouping: try FoodEntry.between(today, last).fetch(db), by: \.day)
        let rows = Dictionary(uniqueKeysWithValues: try NutritionDay.between(today, last).fetch(db).map { ($0.id, $0) })

        let hidden = settings.nutrition.hiddenNutrients
        let nutrients = NutrientRegistry.all.filter { NutrientID.macros.contains($0.id) || !hidden.contains($0.id) }
        let days = (0..<NutritionSnapshot.horizon).map { offset in
            let day = today.adding(days: offset)
            let totals = (rows[day] ?? NutritionDay(id: day)).totals(entries[day] ?? [])
            let targets = NutrientTargets.of(day, plans: plans, goals: goals, profile: settings.profile, latestWeightKg: latestWeightKg)
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
            pinned: settings.nutrition.summaryNutrients.filter { !hidden.contains($0) || NutrientID.macros.contains($0) }.map(\.rawValue),
            showOverages: settings.nutrition.showOverages,
            days: days
        )
    }
}

/// What the steps snapshot reads from the database: the goal and the steps imported from MacroFactor.
private struct StepInputs: Equatable, Sendable {
    let goal: Int
    let imported: [BodyMetric]

    init(_ db: Database) throws {
        goal = try AppSettings.current.fetch(db).profile.dailyStepGoal
        imported = try BodyMetric.series(.steps).fetch(db)
    }
}

private struct StepSources: Equatable, Sendable {
    let health: [DatedValue]
    let inputs: StepInputs

    func snapshot() -> StepsSnapshot {
        let calendar = Calendar.current
        let steps = NutritionExpenditure.steps(health: health, imported: inputs.imported, calendar: calendar)
        return StepsSnapshot(goal: inputs.goal, steps: steps, calendar: calendar)
    }
}
