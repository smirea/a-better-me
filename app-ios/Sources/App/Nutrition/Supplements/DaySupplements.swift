import Feedback
import SwiftUI

/// The day's supplements below its timeline: every one's picture, wrapping to more rows, which a tap expands into a
/// tile each, scrolling them into view since the row sits at the page's bottom. A tile opens the supplement's page and
/// swipes left to Stop. A day none covers shows nothing; the library is in Day Options.
struct DaySupplementsRow: View {
    let day: CalendarDay

    @Environment(FoodLogState.self) private var state
    @Observe(Supplement.all) private var supplements
    @State private var taken = ViewMemo<TakenKey, [DaySupplement]>()
    @ScaledMetric private var pictureSize: CGFloat = 36

    private struct TakenKey: Equatable {
        let supplements: [Supplement]
        let day: CalendarDay
    }

    var body: some View {
        let items = taken(TakenKey(supplements: supplements, day: day)) { supplements.taken(on: day) }
        if !items.isEmpty {
            ScrollViewReader { proxy in
                row(items, proxy: proxy)
            }
        }
    }

    private func row(_ items: [DaySupplement], proxy: ScrollViewProxy) -> some View {
        let expanded = state.supplementsExpanded
        return VStack(spacing: 4) {
            Button {
                withAnimation(.snappy) {
                    state.supplementsExpanded.toggle()
                    if !expanded { proxy.scrollTo(Self.scrollID, anchor: .top) }
                }
            } label: {
                HStack(spacing: 8) {
                    if expanded {
                        Text("Supplements").font(AppFont.rowTitle)
                        Text("\(items.count)").font(AppFont.rowTitle).foregroundStyle(Theme.textSecondary).monospacedDigit()
                        Spacer(minLength: 0)
                    } else {
                        FlowLayout(spacing: 6) {
                            ForEach(items) { item in
                                SupplementPicture(item.supplement, cornerRadius: Theme.tinyCornerRadius)
                                    .frame(width: pictureSize, height: pictureSize)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    Image(systemName: "chevron.down")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.textSecondary)
                        .rotationEffect(.degrees(expanded ? 180 : 0))
                }
                .foregroundStyle(Theme.textPrimary)
                .frame(minHeight: 44)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Supplements")
            .accessibilityValue("\(items.count), \(expanded ? "expanded" : "collapsed")")
            if expanded {
                ForEach(items) { DaySupplementTile(item: $0, day: day) }
            }
        }
        .padding(.top, 10)
        // Opaque, so the Time display's hour line stops above the supplements instead of showing between them.
        .background(Theme.background)
        .id(Self.scrollID)
        .disabled(state.selecting)
        .feedback(self)
    }

    private static let scrollID = "supplements"
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
