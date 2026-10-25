import SwiftUI

/// The finished workout, with its Health numbers once they are saved.
struct SummaryView: View {
    let summary: WatchWorkoutSummary

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Workout Complete", systemImage: "checkmark.circle.fill").font(AppFont.headline(15)).foregroundStyle(Theme.accent)
                    Text(summary.name).font(AppFont.title(18))
                    row("Duration", Duration.seconds(summary.duration).formatted(.time(pattern: .hourMinuteSecond)))
                    row("Sets", "\(summary.completedSets)")
                    row("Volume", "\(summary.unit.fromKg(summary.volumeKg).formatted(.number.precision(.fractionLength(0)))) \(summary.unit.rawValue)")
                    if let health = summary.health {
                        if let value = health.averageHeartRate { row("Avg Heart Rate", "\(Int(value.rounded())) bpm") }
                        if let value = health.maxHeartRate { row("Max Heart Rate", "\(Int(value.rounded())) bpm") }
                        if let value = health.activeEnergyKcal { row("Active Energy", "\(Int(value.rounded())) kcal") }
                        if let value = health.totalEnergyKcal { row("Total Energy", "\(Int(value.rounded())) kcal") }
                    }
                    Button("Done") { WatchModel.shared.summary = nil }
                        .buttonStyle(.glassProminent)
                        .tint(Theme.accent)
                        .padding(.top, 6)
                }
            }
            .watchGlow()
            .onDebugAction(.done) { WatchModel.shared.summary = nil }
        }
    }

    private func row(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title).font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
            Spacer()
            Text(value).font(AppFont.headline(14))
        }
        .accessibilityElement(children: .combine)
    }
}
