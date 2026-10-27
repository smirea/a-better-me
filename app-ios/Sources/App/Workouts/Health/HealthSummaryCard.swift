import SwiftUI

/// Workout Complete's Apple Health section: the saved summary, or the live numbers while the workout still records.
/// Nothing shows when Health recorded nothing.
struct HealthSummaryCard: View {
    let session: WorkoutSession

    private struct Numbers {
        var source: WorkoutHealthSummary.Source?
        var averageHeartRate: Double?
        var maxHeartRate: Double?
        var activeEnergyKcal: Double?
        var totalEnergyKcal: Double?

        var isEmpty: Bool { [averageHeartRate, maxHeartRate, activeEnergyKcal, totalEnergyKcal].allSatisfy { $0 == nil } }
    }

    private var numbers: Numbers? {
        if let health = session.health {
            return Numbers(
                source: health.source, averageHeartRate: health.averageHeartRate, maxHeartRate: health.maxHeartRate,
                activeEnergyKcal: health.activeEnergyKcal, totalEnergyKcal: health.totalEnergyKcal
            )
        }
        let live = WorkoutHealth.shared
        guard live.sessionID == session.id, let stats = live.stats else { return nil }
        return Numbers(
            source: live.recorder.map { if case .phone = $0 { .phone } else { .watch } }, averageHeartRate: stats.averageHeartRate,
            maxHeartRate: stats.maxHeartRate, activeEnergyKcal: stats.activeEnergyKcal,
            totalEnergyKcal: WorkoutRecording.total(stats.activeEnergyKcal, stats.basalEnergyKcal)
        )
    }

    var body: some View {
        if let numbers, !numbers.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                Text("Apple Health").font(AppFont.sectionTitle)
                if let source = numbers.source {
                    Text(source == .watch ? "Recorded on Apple Watch" : "Recorded on iPhone")
                        .font(AppFont.rowDetail)
                        .foregroundStyle(Theme.textSecondary)
                }
                row("Average Heart Rate", icon: "heart.fill", value: numbers.averageHeartRate.map { "\(Int($0.rounded())) bpm" })
                row("Max Heart Rate", icon: "bolt.heart.fill", value: numbers.maxHeartRate.map { "\(Int($0.rounded())) bpm" })
                row("Active Energy", icon: "flame.fill", value: numbers.activeEnergyKcal.map { "\(Int($0.rounded())) kcal" })
                row("Total Energy", icon: "flame", value: numbers.totalEnergyKcal.map { "\(Int($0.rounded())) kcal" })
            }
            .padding(.horizontal, Theme.margin)
        }
    }

    @ViewBuilder
    private func row(_ title: String, icon: String, value: String?) -> some View {
        if let value {
            Divider().overlay(Theme.separator)
            HStack(spacing: 16) {
                RowLabel(title: title, systemImage: icon)
                Spacer()
                Text(value).font(AppFont.rowTitle)
            }
            .frame(minHeight: 52)
            .accessibilityElement(children: .combine)
        }
    }
}
