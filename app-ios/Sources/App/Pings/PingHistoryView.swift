import Charts
import Feedback
import SwiftUI

/// One ping's last 30 days: what it adds up to, a bar per day, and each log with its note. The Pings tab and the
/// ping's Dashboard card push it.
struct PingHistoryView: View {
    let pingID: UUID
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        // Reading `scenePhase` re-evaluates the day when the scene becomes active, so a new day shows on return.
        let _ = scenePhase
        let today = Calendar.current.startOfDay(for: .now)
        Content(pingID: pingID, now: today).id(today)
    }

    private struct Content: View {
        let pingID: UUID
        @Environment(LocalStore.self) private var store
        @Environment(\.dismiss) private var dismiss
        @Observe private var history: PingHistory
        @State private var editing: Ping?

        init(pingID: UUID, now: Date) {
            self.pingID = pingID
            _history = Observe(PingHistory.recent(pingID, now: now, calendar: .current))
        }

        var body: some View {
            let steps = history.ping?.kind.steps ?? []
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 16) {
                        stats(steps)
                        chart(steps)
                    }
                    .card()
                    if !history.logs.isEmpty {
                        TruncatedList("Last 30 Days", items: history.logs) { log in
                            PingLogRow(log: log, steps: steps)
                                .rowSwipeActions(trailing: [.destructive("Delete") { store.delete(PingLog.self, id: log.id) }])
                        } destination: {
                            PingLogsView(pingID: pingID, steps: steps)
                        }
                    }
                }
                .padding(.horizontal, Theme.margin)
                .padding(.vertical, 8)
            }
            .background(Theme.background)
            .detailTitle(history.ping?.name ?? "")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button("Edit Ping", systemImage: "pencil") { editing = history.ping }
                }
            }
            .sheet(item: $editing) { PingEditor(ping: $0) }
            .onChange(of: history.ping == nil) { _, deleted in
                if deleted { dismiss() }
            }
            .feedback(self)
        }

        private func stats(_ steps: [String]) -> some View {
            HStack(alignment: .top) {
                if steps.isEmpty {
                    StatView(title: "Today", value: "\(history.count(days: 1))")
                    StatView(title: "7 Days", value: "\(history.count(days: 7))")
                    StatView(title: "30 Days", value: "\(history.count(days: 30))")
                } else {
                    StatView(title: "Latest", value: history.logs.first.map { "\($0.value)" } ?? "--")
                    StatView(title: "7-Day Average", value: history.average(days: 7, calendar: .current)?.niceText ?? "--")
                    StatView(title: "30-Day Average", value: history.average(days: 30, calendar: .current)?.niceText ?? "--")
                }
            }
            .feedback("Stats")
        }

        private func chart(_ steps: [String]) -> some View {
            let days = history.days
            let noons = days.map { $0.date.addingTimeInterval(12 * 3600) }
            return Chart(Array(days.enumerated()), id: \.offset) { index, day in
                BarMark(
                    x: .value("Day", noons[index], unit: .day),
                    y: .value("Value", steps.isEmpty ? Double(day.count) : day.average ?? 0),
                    width: .ratio(0.7)
                )
                .foregroundStyle(Theme.ping)
            }
            .chartYScale(domain: 0...Double(steps.isEmpty ? max(days.map(\.count).max() ?? 0, 1) : steps.count))
            .chartXAxis {
                AxisMarks(values: .stride(by: .day, count: 7)) { _ in
                    AxisValueLabel(format: .dateTime.month(.abbreviated).day()).foregroundStyle(Theme.textSecondary)
                }
            }
            .themedYAxis()
            .chartScrubbing(noons) { index in
                let day = days[index]
                let value = steps.isEmpty ? "\(day.count)" : day.average?.niceText ?? "--"
                return ChartCallout(
                    title: day.date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()),
                    lines: [ChartCallout.Line(label: steps.isEmpty ? "Logged" : "Average", value: value, color: Theme.ping)]
                )
            }
            .frame(height: 160)
            .accessibilityLabel("\(history.ping?.name ?? "Ping") by day")
            .feedback("Chart")
        }
    }
}

/// Every log of a ping, newest first. Read off the main thread, since a ping logged several times a day holds
/// thousands of rows within a year.
private struct PingLogsView: View {
    let pingID: UUID
    let steps: [String]
    @Environment(LocalStore.self) private var store
    @State private var logs: [PingLog] = []

    var body: some View {
        List {
            ThemedSection {
                ForEach(logs) { log in
                    PingLogRow(log: log, steps: steps)
                        .swipeActions {
                            Button("Delete", role: .destructive) {
                                logs.removeAll { $0.id == log.id }
                                store.delete(PingLog.self, id: log.id)
                            }
                        }
                }
            }
        }
        .themedList()
        .detailTitle("History")
        .task {
            let query = PingLog.history(pingID)
            logs = (try? await store.read(query.fetch)) ?? []
        }
        .feedback(self)
    }
}

private struct PingLogRow: View {
    let log: PingLog
    let steps: [String]

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            RowLabel(
                title: log.loggedAt.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day().hour().minute()),
                detail: log.note.isEmpty ? nil : log.note
            )
            Spacer(minLength: 8)
            if steps.indices.contains(log.value - 1) {
                Text(steps[log.value - 1]).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary).lineLimit(1)
                Text("\(log.value)").font(AppFont.number(16))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface)
        .accessibilityElement(children: .combine)
        .feedback(self)
    }
}
