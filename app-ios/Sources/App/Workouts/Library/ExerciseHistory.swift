import SwiftUI

struct ExerciseHistoryEntry: Identifiable {
    let id: UUID
    let date: Date
    let workoutName: String
    /// Completed sets, warm-ups included, in workout order.
    let sets: [WorkoutSet]
    var records: [HistoryMetric: Double] = [:]

    var workingSets: [WorkoutSet] { sets.filter { $0.type != .warmUp } }
}

/// The "Exercise Display" dropdown.
enum HistoryMetric: String, CaseIterable, Identifiable {
    case oneRepMax = "1-RM"
    case threeRepMax = "3-RM"
    case tenRepMax = "10-RM"
    case heaviestWeight = "Heaviest Weight"
    case totalVolume = "Total Volume"
    case bestSetVolume = "Best Set Volume"
    case totalReps = "Total Reps"
    case bestSetReps = "Best Set Reps"
    case totalSets = "Total Sets"

    var id: Self { self }

    static let recordKinds: [HistoryMetric] = [.totalVolume, .bestSetReps, .oneRepMax]

    var recordIcon: String {
        switch self {
        case .totalVolume: "trophy.fill"
        case .bestSetReps: "asterisk"
        default: "medal.fill"
        }
    }

    func value(of entry: ExerciseHistoryEntry, exercise: Exercise) -> Double? {
        let sets = entry.workingSets
        let logs = sets.flatMap { [$0.log] + $0.subSets.map(\.log) }.compactMap { $0 }
        let setReps = sets.map { ([$0.log] + $0.subSets.map(\.log)).compactMap { $0?.reps }.reduce(0, +) }
        // An assistance weight lightens the lift, so a bigger one is not a stronger set.
        let isAssisted = exercise.metrics.contains(.assistanceWeight)
        let result: Double? = switch self {
        case .oneRepMax where isAssisted, .threeRepMax where isAssisted, .tenRepMax where isAssisted, .heaviestWeight where isAssisted: nil
        case .oneRepMax: Self.bestRepMax(logs, reps: 1)
        case .threeRepMax: Self.bestRepMax(logs, reps: 3)
        case .tenRepMax: Self.bestRepMax(logs, reps: 10)
        case .heaviestWeight: logs.compactMap(\.weightKg).max()
        case .totalVolume: entry.sets.map { WorkoutMetrics.volumeKg(of: $0, exercise: exercise) }.reduce(0, +)
        case .bestSetVolume: sets.map { WorkoutMetrics.volumeKg(of: $0, exercise: exercise) }.max()
        case .totalReps: Double(setReps.reduce(0, +))
        case .bestSetReps: setReps.max().map(Double.init)
        case .totalSets: Double(sets.count)
        }
        return result.flatMap { $0 > 0 ? $0 : nil }
    }

    private static func bestRepMax(_ logs: [SetLog], reps: Int) -> Double? {
        logs.compactMap { log in
            guard let weight = log.weightKg, weight > 0, let logged = log.reps, logged > 0 else { return nil }
            let oneRepMax = WorkoutMetrics.estimatedOneRepMaxKg(weightKg: weight, reps: logged, rir: log.rir)
            return WorkoutMetrics.estimatedRepMaxKg(oneRepMaxKg: oneRepMax, reps: reps)
        }.max()
    }

    func format(_ value: Double, unit: WeightUnit) -> String {
        switch self {
        case .oneRepMax, .threeRepMax, .tenRepMax, .heaviestWeight, .totalVolume, .bestSetVolume: "\(unit.format(kg: value)) \(unit.rawValue)"
        case .totalReps, .bestSetReps: "\(Int(value)) reps"
        case .totalSets: "\(Int(value)) sets"
        }
    }
}

enum HistorySort: String, CaseIterable, Identifiable {
    case mostRecent = "Most Recent", oldest = "Oldest", highest = "Highest", lowest = "Lowest"
    var id: Self { self }
}

/// On shows record badges, Only also hides sessions without a record, and Off hides the badges.
enum RecordsFilter: String, CaseIterable, Identifiable {
    case on = "Records On", only = "Records Only", off = "Records Off"
    var id: Self { self }
}

enum ExerciseHistory {
    /// Newest first. A record is a value that beats every earlier session's.
    static func entries(of exercise: Exercise, in sessions: [WorkoutSession]) -> [ExerciseHistoryEntry] {
        var best: [HistoryMetric: Double] = [:]
        var entries: [ExerciseHistoryEntry] = []
        for session in sessions.sorted(by: { $0.startedAt < $1.startedAt }) where !session.isInProgress {
            let sets = session.blocks.flatMap(\.exercises).filter { $0.exerciseID == exercise.id }.flatMap(\.sets).filter(\.isCompleted)
            guard !sets.isEmpty else { continue }
            var entry = ExerciseHistoryEntry(id: session.id, date: session.startedAt, workoutName: session.name, sets: sets)
            for kind in HistoryMetric.recordKinds {
                guard let value = kind.value(of: entry, exercise: exercise) else { continue }
                if let previous = best[kind], value > previous { entry.records[kind] = value }
                best[kind] = max(value, best[kind] ?? 0)
            }
            entries.append(entry)
        }
        return entries.reversed()
    }

    /// The History tab's list. Highest and Lowest rank by `metric`; sessions without a value go last, and ties
    /// fall back to newest first.
    static func arranged(
        _ entries: [ExerciseHistoryEntry], sort: HistorySort, records: RecordsFilter, metric: HistoryMetric, exercise: Exercise
    ) -> [ExerciseHistoryEntry] {
        let shown = records == .only ? entries.filter { !$0.records.isEmpty } : entries
        switch sort {
        case .mostRecent: return shown.sorted { $0.date > $1.date }
        case .oldest: return shown.sorted { $0.date < $1.date }
        case .highest, .lowest:
            let values = Dictionary(uniqueKeysWithValues: shown.map { ($0.id, metric.value(of: $0, exercise: exercise)) })
            return shown.sorted { a, b in
                switch (values[a.id] ?? nil, values[b.id] ?? nil) {
                case let (x?, y?) where x != y: sort == .highest ? x > y : x < y
                case (_?, nil): true
                case (nil, _?): false
                default: a.date > b.date
                }
            }
        }
    }

    /// "50 lb (per side) x 9 (per side)": the logged values in the exercise's metrics, load first.
    static func describe(_ log: SetLog, exercise: Exercise, unit: WeightUnit) -> String {
        let metrics = exercise.metrics.sorted { $0.isWeight && !$1.isWeight }
        return metrics.compactMap { metric -> String? in
            let side = metric.isPerSide ? " (per side)" : ""
            switch metric {
            case .weight, .weightPerSide, .weightPerSidePersistent:
                return log.weightKg.map { "\(unit.format(kg: $0)) \(unit.rawValue)\(side)" }
            case .assistanceWeight:
                return log.weightKg.map { "\(unit.format(kg: $0)) \(unit.rawValue) assist" }
            case .reps, .repsPerSide:
                return log.reps.map { "\($0)\(side)" }
            case .duration, .durationPerSide:
                return log.durationSeconds.map { Duration.seconds($0).formatted(.time(pattern: .minuteSecond)) + side }
            case .distanceShort, .distanceShortPerSide, .distanceLong:
                return log.distanceMeters.map {
                    Measurement(value: $0, unit: UnitLength.meters).formatted(.measurement(width: .abbreviated, usage: .road)) + side
                }
            }
        }.joined(separator: " x ")
    }
}

struct ExerciseHistoryTab: View {
    let exercise: Exercise
    @Observe(WorkoutSession.finished) private var sessions
    @Observe(AppSettings.current) private var settings
    @State private var metric = HistoryMetric.oneRepMax
    @State private var sort = HistorySort.mostRecent
    @State private var records = RecordsFilter.on
    @State private var expanded: Set<UUID> = []

    var body: some View {
        let entries = ExerciseHistory.entries(of: exercise, in: sessions)
        let shown = ExerciseHistory.arranged(entries, sort: sort, records: records, metric: metric, exercise: exercise)
        VStack(alignment: .leading, spacing: 0) {
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    Menu {
                        Picker("Exercise Display", selection: $metric) {
                            ForEach(HistoryMetric.allCases) { Text($0.rawValue).tag($0) }
                        }
                    } label: {
                        FilterChipLabel(title: metric.rawValue, systemImage: "medal")
                    }
                    Menu {
                        Picker("Sort", selection: $sort) {
                            ForEach(HistorySort.allCases) { Text($0.rawValue).tag($0) }
                        }
                    } label: {
                        FilterChipLabel(title: sort.rawValue, systemImage: "line.3.horizontal.decrease")
                    }
                    Menu {
                        Picker("Records", selection: $records) {
                            ForEach(RecordsFilter.allCases) { Text($0.rawValue).tag($0) }
                        }
                    } label: {
                        FilterChipLabel(title: records.rawValue, systemImage: "trophy")
                    }
                }
                .padding()
            }
            .scrollIndicators(.hidden)
            if entries.isEmpty {
                ContentUnavailableView(
                    "No History",
                    systemImage: "clock.arrow.circlepath",
                    description: Text("Log this exercise in a workout to see it here.")
                )
            } else if shown.isEmpty {
                ContentUnavailableView("No Records", systemImage: "trophy", description: Text("No session of this exercise set a record yet."))
            }
            ForEach(shown) { entry in
                HistoryRow(
                    entry: entry,
                    exercise: exercise,
                    metric: metric,
                    showsRecords: records != .off,
                    unit: settings.weightUnit,
                    isExpanded: Binding {
                        expanded.contains(entry.id)
                    } set: { open in
                        if open { expanded.insert(entry.id) } else { expanded.remove(entry.id) }
                    }
                )
                Divider().overlay(Theme.separator)
            }
        }
    }
}

private struct HistoryRow: View {
    let entry: ExerciseHistoryEntry
    let exercise: Exercise
    let metric: HistoryMetric
    let showsRecords: Bool
    let unit: WeightUnit
    @Binding var isExpanded: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button { withAnimation { isExpanded.toggle() } } label: {
                HStack(spacing: 14) {
                    Image(systemName: "dumbbell.fill")
                        .foregroundStyle(.white)
                        .frame(width: 40, height: 40)
                        .background(Theme.accent, in: .rect(cornerRadius: Theme.smallCornerRadius))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(entry.date.formatted(date: .long, time: .omitted)).font(AppFont.medium(15))
                        Text(entry.workoutName).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                        if let value = metric.value(of: entry, exercise: exercise) {
                            Text(metric.format(value, unit: unit)).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                        }
                        if showsRecords && !entry.records.isEmpty {
                            HStack(spacing: 10) {
                                ForEach(HistoryMetric.recordKinds.filter { entry.records[$0] != nil }) { kind in
                                    Label(kind.format(entry.records[kind]!, unit: unit), systemImage: kind.recordIcon)
                                        .labelStyle(.titleAndIcon)
                                }
                            }
                            .font(AppFont.caption(12))
                            .foregroundStyle(Theme.textPrimary)
                        }
                    }
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down").foregroundStyle(Theme.textSecondary)
                }
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            if isExpanded {
                ForEach(Array(entry.sets.enumerated()), id: \.element.id) { index, set in
                    HStack(spacing: 12) {
                        Text(set.type.badge ?? "\(entry.sets[...index].count { $0.type != .warmUp })")
                            .font(AppFont.headline(11))
                            .frame(width: 22, height: 22)
                            .background(Theme.surfaceRaised, in: .circle)
                        Text(set.log.map { ExerciseHistory.describe($0, exercise: exercise, unit: unit) } ?? "")
                            .font(AppFont.body(14))
                        Spacer()
                        if exercise.tracksReps { RIRBadge(rir: set.log?.rir) }
                    }
                    ForEach(set.subSets.filter { $0.log != nil }) { sub in
                        HStack(spacing: 12) {
                            Image(systemName: "plus")
                                .font(AppFont.headline(9))
                                .frame(width: 22, height: 22)
                            Text(sub.log.map { ExerciseHistory.describe($0, exercise: exercise, unit: unit) } ?? "")
                                .font(AppFont.body(14))
                            Spacer()
                            if exercise.tracksReps { RIRBadge(rir: sub.log?.rir) }
                        }
                        .padding(.leading, 22)
                    }
                }
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 12)
    }
}
