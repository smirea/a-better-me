import SwiftUI

/// The finished workout, with its Health numbers once the recording is saved.
struct SummaryView: View {
    let workout: WatchWorkout
    private var model: WatchModel { .shared }

    var body: some View {
        let health = model.health[workout.sessionID]
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Workout Complete", systemImage: "checkmark.seal.fill").font(AppFont.headline(14)).foregroundStyle(Theme.green)
                    Text(workout.name).font(AppFont.title(20))
                    Text(Duration.seconds(workout.elapsed(at: .now)).formatted(.time(pattern: .hourMinuteSecond)))
                        .font(AppFont.number(30))
                        .foregroundStyle(Theme.amber)
                    tiles([
                        ("Sets", "\(workout.completedSets)"),
                        ("Volume", "\(workout.unit.fromKg(workout.volumeKg).formatted(.number.precision(.fractionLength(0)))) \(workout.unit.rawValue)"),
                        ("Avg HR", health?.averageHeartRate.map { "\(Int($0.rounded()))" } ?? "–"),
                        ("Kcal", health?.activeEnergyKcal.map { "\(Int($0.rounded()))" } ?? "–"),
                    ])
                    Button {
                        model.dismissSummary()
                    } label: {
                        Text("Done").font(AppFont.headline(16)).frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.glassProminent)
                    .tint(Theme.accent)
                    .padding(.top, 4)
                }
            }
            .watchGlow(Theme.green)
        }
    }

    private func tiles(_ items: [(String, String)]) -> some View {
        Grid(horizontalSpacing: 6, verticalSpacing: 6) {
            ForEach(0..<(items.count + 1) / 2, id: \.self) { row in
                GridRow {
                    ForEach(items[(row * 2)..<min(row * 2 + 2, items.count)], id: \.0) { title, value in
                        VStack(alignment: .leading, spacing: 0) {
                            Text(value).font(AppFont.number(17)).lineLimit(1).minimumScaleFactor(0.6)
                            Text(title.uppercased()).font(AppFont.headline(9)).foregroundStyle(Theme.textSecondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(8)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                        .accessibilityElement(children: .combine)
                    }
                }
            }
        }
    }
}
