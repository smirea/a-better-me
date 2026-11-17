import Feedback
import SwiftUI

/// The day's supplements above its timeline: their pictures in one row, which a tap expands into a tile each. A tile
/// opens the supplement's page and swipes left to Stop. A day none covers shows nothing; the library is in Day Options.
struct DaySupplementsRow: View {
    let day: CalendarDay

    @Environment(FoodLogState.self) private var state
    @Observe(Supplement.all) private var supplements
    @State private var taken = ViewMemo<TakenKey, [DaySupplement]>()

    private struct TakenKey: Equatable {
        let supplements: [Supplement]
        let day: CalendarDay
    }

    /// As many pictures as fit the narrowest phone beside the chevron; past it the last slot counts the rest.
    private static let stripLimit = 8

    var body: some View {
        let items = taken(TakenKey(supplements: supplements, day: day)) { supplements.taken(on: day) }
        if !items.isEmpty {
            let expanded = state.supplementsExpanded
            VStack(spacing: 4) {
                Button {
                    withAnimation(.snappy) { state.supplementsExpanded.toggle() }
                } label: {
                    HStack(spacing: 6) {
                        if expanded {
                            Text("Supplements").font(AppFont.rowTitle)
                            Text("\(items.count)").font(AppFont.rowTitle).foregroundStyle(Theme.textSecondary).monospacedDigit()
                        } else {
                            strip(items)
                        }
                        Spacer(minLength: 8)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.textSecondary)
                            .rotationEffect(.degrees(expanded ? 180 : 0))
                    }
                    .foregroundStyle(Theme.textPrimary)
                    .padding(.horizontal, 12)
                    .frame(height: 44)
                    .background(Theme.surface, in: .rect(cornerRadius: Theme.smallCornerRadius))
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Supplements")
                .accessibilityValue("\(items.count), \(expanded ? "expanded" : "collapsed")")
                if expanded {
                    ForEach(items) { DaySupplementTile(item: $0, day: day) }
                }
            }
            .padding(.bottom, 10)
            // Opaque, so the Time display's hour line starts under the supplements instead of showing between them.
            .background(Theme.background)
            .disabled(state.selecting || state.pending != nil)
            .feedback(self)
        }
    }

    @ViewBuilder
    private func strip(_ items: [DaySupplement]) -> some View {
        let shown = items.count > Self.stripLimit ? Self.stripLimit - 1 : items.count
        ForEach(items.prefix(shown)) { item in
            SupplementPicture(item.supplement, cornerRadius: Theme.tinyCornerRadius).frame(width: 28, height: 28)
        }
        if shown < items.count {
            Text("+\(items.count - shown)")
                .font(AppFont.badge)
                .foregroundStyle(Theme.textSecondary)
                .frame(width: 28, height: 28)
                .background(Theme.surfaceRaised, in: .rect(cornerRadius: Theme.tinyCornerRadius))
        }
    }
}

private struct DaySupplementTile: View {
    let item: DaySupplement
    let day: CalendarDay

    @Environment(FoodLogState.self) private var state
    @Environment(LocalStore.self) private var store

    var body: some View {
        Button { state.path.append(SupplementRoute.detail(item.id, day: day)) } label: {
            HStack(spacing: 12) {
                SupplementPicture(item.supplement).frame(width: 40, height: 40)
                RowLabel(title: item.supplement.name, detail: SupplementFormat.dose(item.regimen, of: item.supplement.serving))
                Spacer(minLength: 8)
                Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.textSecondary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Theme.surface, in: .rect(cornerRadius: Theme.smallCornerRadius))
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .rowSwipeActions(trailing: [SwipeAction(title: "Stop", systemImage: "stop") { stop() }])
        .accessibilityHint("Opens the supplement")
        .accessibilityAction(named: "Stop Taking") { stop() }
        .feedback(self)
    }

    /// A past day keeps the tile, since it was taken then, so the notice says what changed.
    private func stop() {
        store.stopSupplement(item.id)
        state.notice = .init(message: "Stopped taking \(item.supplement.name)")
    }
}
