import SwiftUI

/// Heart rate with its zone, the workout clock, active energy, and sets done.
struct StatsPage: View {
    let status: LiveWorkoutStatus
    private var model: WatchModel { .shared }

    var body: some View {
        let metrics = model.metrics
        let zone = metrics?.heartRate.map { HeartRateZone(heartRate: $0, max: model.maxHeartRate) }
        NavigationStack {
            VStack(alignment: .leading, spacing: 6) {
                Text(timerInterval: status.pauseAdjustedStart...Date.distantFuture, pauseTime: status.pausedAt, countsDown: false, showsHours: true)
                    .font(AppFont.number(30))
                    .foregroundStyle(Theme.amber)
                    .accessibilityLabel("Elapsed time")
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(metrics?.heartRate.map { "\(Int($0.rounded()))" } ?? "--").font(AppFont.number(30))
                    Image(systemName: "heart.fill").foregroundStyle(zone?.color ?? Theme.destructive)
                    Text("BPM").font(AppFont.caption(11)).foregroundStyle(Theme.textSecondary)
                }
                .accessibilityElement(children: .combine)
                HStack(spacing: 2) {
                    ForEach(HeartRateZone.allCases, id: \.self) { each in
                        Capsule().fill(each.color.opacity(each == zone ? 1 : 0.25)).frame(height: 5)
                    }
                }
                Text(zone.map { "Zone \($0.rawValue)" } ?? "No heart rate")
                    .font(AppFont.caption(11))
                    .foregroundStyle(zone?.color ?? Theme.textSecondary)
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(metrics?.activeEnergyKcal.map { "\(Int($0.rounded()))" } ?? "--").font(AppFont.number(24))
                    Text("ACTIVE KCAL").font(AppFont.caption(11)).foregroundStyle(Theme.textSecondary)
                }
                .accessibilityElement(children: .combine)
                Text("\(status.completedSets) of \(status.totalSets) sets").font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .watchGlow()
        }
    }
}
