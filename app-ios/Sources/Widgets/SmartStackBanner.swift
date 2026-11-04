import SwiftUI

/// The Live Activity on a paired watch (`.small`). Its card is about 180 × 72 pt, and the banner's taller layout was
/// clipped there, so it keeps three rows that always fit: the caption and workout clock, the exercise, then the set's
/// values or the rest countdown. It has no buttons: a tap opens the watch app (`WKSupportsLiveActivityLaunchAttributeTypes`
/// in `Watch-Info.plist`), which logs sets, rests, and finishes on its own.
struct SmartStackBanner: View {
    let phase: Phase

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(phase.caption)
                    .font(AppFont.caption(12))
                    .foregroundStyle(phase.captionColor)
                    .lineLimit(1)
                Spacer(minLength: 0)
                clock
                    .font(AppFont.number(12))
                    .multilineTextAlignment(.trailing)
                    .frame(width: 52, alignment: .trailing)
            }
            Text(phase.title)
                .font(AppFont.headline(15))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Spacer(minLength: 2)
            detail
        }
        .foregroundStyle(Theme.textPrimary)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    @ViewBuilder private var clock: some View {
        switch phase {
        case .rest(let status, _): WorkoutClock(status: status).foregroundStyle(Theme.textSecondary)
        default: PhaseClock(phase: phase)
        }
    }

    @ViewBuilder private var detail: some View {
        switch phase {
        case .rest(let status, let rest):
            HStack(alignment: .lastTextBaseline, spacing: 6) {
                RestCountdown(rest: rest)
                    .font(AppFont.number(28))
                    .foregroundStyle(Theme.accent)
                    .frame(maxWidth: 76, alignment: .leading)
                Spacer(minLength: 0)
                if let next = phase.shownSet {
                    CompactStats(set: next, unit: status.unit, showsRIR: false)
                        .fixedSize()
                        .layoutPriority(1)
                }
            }
        case .finished(let status, let endedAt):
            Text("\(elapsed(from: status.pauseAdjustedStart, to: endedAt)) · \(status.completedSets) of \(status.totalSets) sets")
                .font(AppFont.caption(13))
                .foregroundStyle(Theme.textSecondary)
                .lineLimit(1)
        case .set, .paused, .allDone:
            if let set = phase.shownSet {
                HStack(spacing: 8) {
                    Thumbnail(set: set, size: 30)
                    CompactStats(set: set, unit: phase.status.unit)
                    Spacer(minLength: 0)
                }
            } else {
                ProgressLine(status: phase.status)
            }
        }
    }
}

/// The set's values as small numbers over caps units, then the RIR badge: "60 LB  10 REPS (2)".
private struct CompactStats: View {
    let set: LiveSet
    let unit: WeightUnit
    /// The rest card leaves the badge out to keep room for the countdown on a 40 mm watch.
    var showsRIR = true

    var body: some View {
        let stats = set.stats(unit: unit)
        HStack(alignment: .center, spacing: 8) {
            ForEach(stats.indices, id: \.self) { index in
                VStack(alignment: .leading, spacing: -2) {
                    Text(stats[index].value)
                        .font(AppFont.number(17))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    Text(stats[index].unit)
                        .font(AppFont.medium(9))
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            if showsRIR, let rir = set.values.rir {
                RIRBadge(rir: rir)
            }
        }
        .accessibilityElement(children: .combine)
    }
}
