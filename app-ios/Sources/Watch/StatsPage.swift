import SwiftUI

/// The workout clock, heart rate with its zone, active energy, and progress.
struct StatsPage: View {
    let workout: WatchWorkout
    private var model: WatchModel { .shared }

    var body: some View {
        let metrics = model.metrics
        let zone = metrics?.heartRate.map { HeartRateZone(heartRate: $0, max: model.maxHeartRate) }
        NavigationStack {
            VStack(alignment: .leading, spacing: 4) {
                WorkoutClock(workout: workout, size: 30).foregroundStyle(Theme.amber)
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(metrics?.heartRate.map { "\(Int($0.rounded()))" } ?? "–").font(AppFont.number(28)).foregroundStyle(metrics?.heartRate == nil ? Theme.textTertiary : Theme.textPrimary)
                    Image(systemName: "heart.fill").foregroundStyle(zone?.color ?? Theme.destructive).symbolEffect(.pulse, isActive: metrics?.heartRate != nil)
                    Text(zone.map { "ZONE \($0.rawValue)" } ?? "BPM").font(AppFont.headline(10)).foregroundStyle(zone?.color ?? Theme.textSecondary)
                }
                .accessibilityElement(children: .combine)
                HStack(spacing: 2) {
                    ForEach(HeartRateZone.allCases, id: \.self) { each in
                        Capsule().fill(each.color.opacity(each == zone ? 1 : 0.25)).frame(height: 5)
                    }
                }
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(metrics?.activeEnergyKcal.map { "\(Int($0.rounded()))" } ?? "–").font(AppFont.number(22)).foregroundStyle(metrics?.activeEnergyKcal == nil ? Theme.textTertiary : Theme.textPrimary)
                    Text("KCAL").font(AppFont.headline(10)).foregroundStyle(Theme.textSecondary)
                }
                .accessibilityElement(children: .combine)
                ProgressView(value: Double(workout.completedSets), total: Double(max(workout.totalSets, 1))) {
                    Text("\(workout.completedSets) of \(workout.totalSets) sets").font(AppFont.caption(11)).foregroundStyle(Theme.textSecondary)
                }
                .tint(Theme.accent)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .watchGlow()
        }
    }
}
