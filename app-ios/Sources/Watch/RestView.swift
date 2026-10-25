import SwiftUI

/// Rest: a big countdown, ±15 s, skip, and the set that follows.
struct RestView: View {
    let rest: LiveRest
    let next: LiveSet?
    let unit: WeightUnit

    var body: some View {
        VStack(spacing: 4) {
            Text("REST").font(AppFont.display(12)).foregroundStyle(Theme.accent)
            Text(timerInterval: rest.startedAt...rest.endsAt, countsDown: true)
                .font(AppFont.number(46))
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
            HStack(spacing: 8) {
                adjust(-15, icon: "15.arrow.trianglehead.counterclockwise", label: "Rest 15 seconds less")
                adjust(15, icon: "15.arrow.trianglehead.clockwise", label: "Rest 15 seconds more")
            }
            if let next { upNext(next) }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Skip rest", systemImage: "forward.fill") { WatchModel.shared.send(.skipRest) }
            }
        }
        .onDebugAction(.skipRest) { WatchModel.shared.send(.skipRest) }
        .onDebugAction(.restLess) { WatchModel.shared.send(.adjustRest(seconds: -15)) }
        .onDebugAction(.restMore) { WatchModel.shared.send(.adjustRest(seconds: 15)) }
    }

    private func adjust(_ seconds: Int, icon: String, label: String) -> some View {
        Button(label, systemImage: icon) { WatchModel.shared.send(.adjustRest(seconds: seconds)) }
            .labelStyle(.iconOnly)
            .font(.system(size: 15, weight: .semibold))
            .frame(maxWidth: .infinity)
            .buttonStyle(.glass)
            .controlSize(.small)
    }

    private func upNext(_ set: LiveSet) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Label(set.position.uppercased(), systemImage: "forward.fill")
                .font(AppFont.caption(10))
                .foregroundStyle(Theme.textSecondary)
            Text(set.setType.title ?? set.exerciseName).font(AppFont.headline(12)).lineLimit(1)
            Text(set.pills.map { MetricScale.text($0, in: set.values, unit: unit) }.map { "\($0.value) \($0.caption)" }.joined(separator: " · "))
                .font(AppFont.medium(12))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Theme.textPrimary.opacity(0.1), in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Up next")
    }
}
