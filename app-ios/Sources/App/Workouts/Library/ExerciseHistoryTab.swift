import Feedback
import SwiftUI

struct ExerciseHistoryTab: View {
    let exercise: Exercise
    @Environment(SessionHistory.self) private var history
    @Observe(AppSettings.current) private var settings
    @State private var metric = HistoryMetric.oneRepMax
    @State private var sort = HistorySort.mostRecent
    @State private var records = RecordsFilter.on
    @State private var expanded: Set<UUID> = []

    private struct EntriesKey: Hashable { let exercise: Exercise }

    private struct ArrangedKey: Hashable {
        let exercise: Exercise
        let sort: HistorySort
        let records: RecordsFilter
        let metric: HistoryMetric
    }

    var body: some View {
        let entries = history.memo(EntriesKey(exercise: exercise)) { ExerciseHistory.entries(of: exercise, in: $0) }
        let shown = history.memo(ArrangedKey(exercise: exercise, sort: sort, records: records, metric: metric)) { _ in
            ExerciseHistory.arranged(entries, sort: sort, records: records, metric: metric, exercise: exercise)
        }
        VStack(alignment: .leading, spacing: 0) {
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    Menu {
                        Picker("Exercise Display", selection: $metric) {
                            ForEach(HistoryMetric.allCases) { Text($0.rawValue).tag($0) }
                        }
                    } label: {
                        Chip(title: metric.rawValue, systemImage: "medal", trailingImage: "chevron.down")
                    }
                    Menu {
                        Picker("Sort", selection: $sort) {
                            ForEach(HistorySort.allCases) { Text($0.rawValue).tag($0) }
                        }
                    } label: {
                        Chip(title: sort.rawValue, systemImage: "line.3.horizontal.decrease", trailingImage: "chevron.down")
                    }
                    Menu {
                        Picker("Records", selection: $records) {
                            ForEach(RecordsFilter.allCases) { Text($0.rawValue).tag($0) }
                        }
                    } label: {
                        Chip(title: records.rawValue, systemImage: "trophy", trailingImage: "chevron.down")
                    }
                }
                .padding(Theme.margin)
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
        .feedback(self)
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
                        .foregroundStyle(Theme.textPrimary)
                        .frame(width: 40, height: 40)
                        .background(Theme.accent, in: .rect(cornerRadius: Theme.smallCornerRadius))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(entry.date.formatted(date: .long, time: .omitted)).font(AppFont.rowTitle)
                        Text(entry.workoutName).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                        if let value = metric.value(of: entry, exercise: exercise) {
                            Text(metric.format(value, unit: unit)).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                        }
                        if showsRecords && !entry.records.isEmpty {
                            HStack(spacing: 10) {
                                ForEach(HistoryMetric.recordKinds.filter { entry.records[$0] != nil }) { kind in
                                    Label(kind.format(entry.records[kind]!, unit: unit), systemImage: kind.recordIcon)
                                        .labelStyle(.titleAndIcon)
                                }
                            }
                            .font(AppFont.rowDetail)
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
                        SetBadge(type: set.type, number: entry.sets.number(at: index), size: .compact)
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
        .padding(.horizontal, Theme.margin)
        .padding(.vertical, 12)
        .feedback(self)
    }
}
