import SwiftUI

/// MF's Levels tab: average weekly sets per muscle as a body heat map and two ranked lists.
struct LevelsTab: View {
    @Environment(ExerciseCatalog.self) private var catalog
    @Observe(WorkoutSession.finished) private var sessions
    @AppStorage(LevelsPeriod.storageKey) private var period = LevelsPeriod.oneWeek
    @State private var side = BodySide.front

    var body: some View {
        let weekly = WeeklySets(sessions: sessions, period: period, catalog: catalog.exercise)
        NavigationStack {
            List {
                Section {
                    VStack(spacing: 20) {
                        ZStack {
                            BodyMap(values: weekly.totals, side: side)
                                .id(side)
                                .transition(.opacity.combined(with: .scale(scale: 0.96)))
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 340)
                        .overlay(alignment: .bottomTrailing) {
                            Button("Rotate Body", systemImage: "arrow.trianglehead.2.clockwise.rotate.90") {
                                withAnimation(.smooth) { side.toggle() }
                            }
                            .labelStyle(.iconOnly)
                            .font(.title3)
                            .buttonStyle(.glass)
                            .buttonBorderShape(.circle)
                        }
                        PeriodCaption(period: $period)
                    }
                    .listRowBackground(Color.clear)
                }
                LevelsSection(title: "Upper Body Levels", muscles: Muscle.upperBody, weekly: weekly)
                LevelsSection(title: "Lower Body Levels", muscles: Muscle.lowerBody, weekly: weekly)
            }
            .themedList()
            .screenTitle("Levels")
            .navigationDestination(for: Muscle.self) { MuscleLevelsView(muscle: $0) }
        }
    }
}

private struct LevelsSection: View {
    let title: String
    let muscles: [Muscle]
    let weekly: WeeklySets

    var body: some View {
        Section {
            ForEach(weekly.ranked(muscles), id: \.muscle) { muscle, sets in
                let row = MuscleLevelRow(muscle: muscle, sets: sets, top: weekly.top)
                // Untrained muscles have nothing to list, so the reference shows them without a chevron.
                if sets > 0 {
                    NavigationLink(value: muscle) { row }
                } else {
                    row
                }
            }
            .listRowBackground(Theme.surface)
        } header: {
            LevelsHeader(title: title)
        }
    }
}

struct LevelsHeader: View {
    let title: String

    var body: some View {
        Text(title)
            .font(AppFont.title())
            .foregroundStyle(Theme.textPrimary)
            .textCase(nil)
            .padding(.leading, -16)
    }
}

/// The mini figure, name, sets, and a bar scaled to the most-trained muscle.
struct MuscleLevelRow: View {
    let muscle: Muscle
    let sets: Double
    let top: Double

    var body: some View {
        HStack(spacing: 14) {
            MuscleTile(muscle: muscle).frame(width: 52, height: 52)
            VStack(alignment: .leading, spacing: 4) {
                Text(muscle.displayName).font(AppFont.headline(16))
                Text(WeeklySets.label(sets)).font(AppFont.caption(14)).foregroundStyle(Theme.textSecondary)
                if sets > 0, top > 0 {
                    Rectangle()
                        .fill(Theme.muscle.opacity(0.55))
                        .frame(height: 6)
                        .scaleEffect(x: sets / top, anchor: .leading)
                        .padding(.top, 2)
                }
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }
}

/// "● Average weekly sets over 1-week ▾", shared by the tab and the muscle detail through `@AppStorage`.
struct PeriodCaption: View {
    @Binding var period: LevelsPeriod

    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(Theme.muscle).frame(width: 7, height: 7)
            Text("Average weekly sets over")
            Menu {
                Picker("Time Period", selection: $period) {
                    ForEach(LevelsPeriod.allCases) { Text($0.rawValue).tag($0) }
                }
            } label: {
                HStack(spacing: 4) {
                    Text(period.rawValue).underline()
                    Image(systemName: "chevron.down").font(.caption2.weight(.bold))
                }
                .foregroundStyle(Theme.textPrimary)
            }
            .accessibilityLabel("Time Period, \(period.rawValue)")
        }
        .font(AppFont.medium(14))
        .frame(maxWidth: .infinity)
    }
}
