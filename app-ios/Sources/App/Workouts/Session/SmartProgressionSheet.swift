import SwiftUI

/// The wand chip's sheet: the adjusted-targets banner, the Event Log of every fill, and a shortcut to Workout settings.
struct SmartProgressionSheet: View {
    let exerciseName: String
    let sets: [WorkoutSet]
    let suggestions: [UUID: SetSuggestion]
    let events: [ProgressionEvent]
    let unit: WeightUnit

    @Environment(\.dismiss) private var dismiss
    @State private var isShowingSettings = false

    private var adjustedCount: Int { sets.count { suggestions[$0.id]?.adjustedReps != nil } }

    var body: some View {
        NavigationStack {
            List {
                if adjustedCount > 0 {
                    Section { banner }
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets())
                }
                Section("Event Log") {
                    if events.allSatisfy(\.rows.isEmpty) {
                        Text("No fills yet").foregroundStyle(Theme.textSecondary)
                    }
                    ForEach(Array(events.enumerated()), id: \.offset) { _, event in
                        if !event.rows.isEmpty { eventView(event) }
                    }
                }
            }
            .detailTitle("Smart Progression")
            .navigationDestination(isPresented: $isShowingSettings) { WorkoutSettingsView() }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Workout Settings", systemImage: "slider.horizontal.3") { isShowingSettings = true }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private var banner: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "info.circle").font(.title3).padding(.top, 2)
            VStack(alignment: .leading, spacing: 4) {
                Text("Target rep ranges were adjusted").font(AppFont.rowTitle)
                Text("Smart Progression has widened the target rep range of \(adjustedCount) \(adjustedCount == 1 ? "set" : "sets") without making permanent changes to this workout")
                    .font(AppFont.caption())
            }
            Spacer()
            NavigationLink {
                WorkoutTargetsView(exerciseName: exerciseName, sets: sets, suggestions: suggestions)
            } label: {
                Text("Info").font(AppFont.headline(14))
            }
            .buttonStyle(.glassProminent)
            .tint(Theme.muscle)
            .accessibilityLabel("Adjusted targets info")
        }
        .padding(14)
        .background(Theme.muscle.opacity(0.25), in: RoundedRectangle(cornerRadius: Theme.cornerRadius))
    }

    private func eventView(_ event: ProgressionEvent) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(event.at.formatted(date: .omitted, time: .shortened)).font(AppFont.headline(14))
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "wand.and.stars").foregroundStyle(Theme.textSecondary).padding(.top, 2)
                VStack(spacing: 4) {
                    ForEach(Array(event.rows.enumerated()), id: \.offset) { _, row in
                        HStack(spacing: 8) {
                            Text(row.label).font(AppFont.body(14))
                            Spacer()
                            Text(valueText(row)).font(AppFont.medium(14))
                            if let rir = row.rir { RIRBadge(rir: rir) }
                        }
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }

    /// The RIR is drawn as a badge, so the text carries only weight and reps.
    private func valueText(_ row: ProgressionEvent.Row) -> String {
        var row = row
        row.rir = nil
        return row.text(unit: unit)
    }
}

/// "Workout Targets": the planned rep targets next to the ones Expand Rep Range substituted this session.
struct WorkoutTargetsView: View {
    let exerciseName: String
    let sets: [WorkoutSet]
    let suggestions: [UUID: SetSuggestion]

    var body: some View {
        List {
            Section("Current Targets") {
                ForEach(Array(sets.enumerated()), id: \.element.id) { index, set in
                    row(set, number: sets.number(at: index), reps: SetSuggestion.repsText(min: set.target?.repsMin, max: set.target?.repsMax))
                }
            }
            Section("Adjusted Targets") {
                ForEach(Array(sets.enumerated()), id: \.element.id) { index, set in
                    let adjusted = suggestions[set.id]?.adjustedReps
                    row(set, number: sets.number(at: index), reps: adjusted.map { SetSuggestion.repsText(min: $0.lowerBound, max: $0.upperBound) } ?? SetSuggestion.repsText(min: set.target?.repsMin, max: set.target?.repsMax))
                }
            }
        }
        .navigationTitle("Workout Targets")
        .navigationSubtitle(exerciseName)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func row(_ set: WorkoutSet, number: Int, reps: String?) -> some View {
        HStack(spacing: 10) {
            SetBadge(type: set.type, number: number, size: .compact)
            Text(reps.map { "\($0) reps" } ?? "No target set").font(AppFont.body(14))
            Spacer()
            if let rir = set.target?.rir { RIRBadge(rir: rir) }
        }
    }
}
