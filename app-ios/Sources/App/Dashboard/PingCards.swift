import Feedback
import SwiftUI

/// The Dashboard's Pings section: a card per ping, in the pings' order, and nothing while there are none. One
/// observer reads every card's days, so a log re-renders the section once.
struct PingCardsSection: View {
    @Observe private var cards: [PingCard]

    init(today: Date) {
        _cards = Observe(PingCard.all(now: today, calendar: .current))
    }

    var body: some View {
        if !cards.isEmpty {
            DashboardSectionView(title: "Pings") {
                ForEach(cards) { PingCardView(card: $0) }
            }
        }
    }
}

private struct PingCardView: View {
    let card: PingCard

    var body: some View {
        NavigationLink(value: DashboardRoute.ping(card.id)) {
            switch card.chart {
            case let .days(levels):
                DashboardCard(title: card.ping.name, period: "Last 30 Days", value: card.value?.wholeText, unit: "today") {
                    DotGrid(levels: levels, color: card.ping.tint)
                }
            case let .week(averages, steps):
                DashboardCard(title: card.ping.name, period: "Last 7 Days", value: card.value?.niceText, unit: "of \(steps) avg") {
                    MiniBars(values: averages, color: card.ping.tint, top: Double(steps))
                }
            }
        }
        .feedback(self)
    }
}
