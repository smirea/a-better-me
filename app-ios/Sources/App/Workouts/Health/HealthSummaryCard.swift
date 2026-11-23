import Feedback
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
                let rows = [
                    ("Average Heart Rate", "heart.fill", numbers.averageHeartRate.map { "\($0.wholeText) bpm" }),
                    ("Max Heart Rate", "bolt.heart.fill", numbers.maxHeartRate.map { "\($0.wholeText) bpm" }),
                    ("Active Energy", "flame.fill", numbers.activeEnergyKcal.map { "\($0.wholeText) cal" }),
                    ("Total Energy", "flame", numbers.totalEnergyKcal.map { "\($0.wholeText) cal" }),
                ].compactMap { title, icon, value in value.map { (title: title, icon: icon, value: $0) } }
                ForEach(Array(rows.enumerated()), id: \.element.title) { index, row in
                    if index > 0 { Divider().overlay(Theme.separator) }
                    self.row(row.title, icon: row.icon, value: row.value)
                }
            }
            .feedback(self)
            .padding(.horizontal, Theme.margin)
        }
    }

    private func row(_ title: String, icon: String, value: String) -> some View {
        HStack(spacing: 16) {
            RowLabel(title: title, systemImage: icon)
            Spacer()
            Text(value).font(AppFont.rowTitle)
        }
        .frame(minHeight: 52)
        .accessibilityElement(children: .combine)
    }
}
