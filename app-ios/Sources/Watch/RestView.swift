import SwiftUI

/// Rest: a big countdown in a draining ring, −15 s, skip, +15 s, and the set that follows.
struct RestView: View {
    let workout: WatchWorkout
    let rest: LiveRest

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                TimelineView(.periodic(from: .now, by: 0.5)) { context in
                    let left = max(0, rest.endsAt.timeIntervalSince(context.date))
                    Circle()
                        .trim(from: 0, to: rest.duration > 0 ? left / rest.duration : 0)
                        .stroke(Theme.lavender, style: StrokeStyle(lineWidth: 7, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .animation(.linear(duration: 0.5), value: left)
                }
                Circle().stroke(Theme.lavender.opacity(0.18), lineWidth: 7)
                VStack(spacing: 0) {
                    Text("REST").font(AppFont.headline(10)).foregroundStyle(Theme.lavender)
                    Text(timerInterval: rest.startedAt...rest.endsAt, countsDown: true)
                        .font(AppFont.number(36))
                        .multilineTextAlignment(.center)
                        .minimumScaleFactor(0.6)
                        .accessibilityLabel("Rest left")
                }
                .padding(.horizontal, 14)
            }
            .frame(width: 112, height: 112)
            HStack(spacing: 6) {
                adjust(-15, icon: "minus", label: "Rest 15 seconds less")
                Button {
                    WatchModel.shared.act(.skipRest)
                } label: {
                    Image(systemName: "forward.end.fill").font(.system(size: 15, weight: .bold)).frame(maxWidth: .infinity)
                }
                .buttonStyle(.glassProminent)
                .tint(Theme.lavender)
                .accessibilityLabel("Skip rest")
                adjust(15, icon: "plus", label: "Rest 15 seconds more")
            }
            .controlSize(.small)
            if let path = workout.currentRow { upNext(workout.set(at: path)) }
        }
    }

    private func adjust(_ seconds: Int, icon: String, label: String) -> some View {
        Button {
            WatchModel.shared.act(.adjustRest(seconds: seconds))
        } label: {
            HStack(spacing: 1) {
                Image(systemName: icon).font(.system(size: 10, weight: .bold))
                Text("15").font(AppFont.headline(13))
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.glass)
        .accessibilityLabel(label)
    }

    private func upNext(_ set: LiveSet) -> some View {
        let values = set.pills.map { MetricScale.text($0, in: set.values, unit: workout.unit) }.map { "\($0.value) \($0.caption.lowercased())" }
        return VStack(spacing: 0) {
            Text("NEXT · \(set.exerciseName.uppercased())")
                .font(AppFont.headline(9))
                .foregroundStyle(Theme.textSecondary)
                .lineLimit(1)
            Text(values.joined(separator: " · "))
                .font(AppFont.medium(12))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Up next \(set.exerciseName)")
    }
}
