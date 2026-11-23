import Feedback
import GRDB
import SwiftUI

/// Full Strain & Stress detail view with the shared day-strip header (Back left, Calendar / Go to Today right),
/// cardless interactive stress chart, daily recovery/biometric stats, and the standard Pings timeline.
struct StrainDetailView: View {
    var openPing: (Ping) -> Void = { _ in }

    @Environment(\.dismiss) private var dismiss
    @State private var day = CalendarDay.today

    var body: some View {
        StrainDayDetailBody(day: day, openPing: openPing)
            .background(Theme.background)
            .safeAreaInset(edge: .top, spacing: 0) {
                StrainDayHeader(day: $day, back: dismiss.callAsFunction)
            }
            .navigationTitle("Strain & Stress")
            .toolbarVisibility(.hidden, for: .navigationBar)
            .feedback(self)
    }
}

private struct StrainDayHeader: View {
    @Binding var day: CalendarDay
    let back: () -> Void

    var body: some View {
        DayHeaderRow(day: $day) {
            Button("Back", systemImage: "chevron.backward", action: back)
        } strip: {
            DayStrip(selected: day) { shown in
                StrainDayPill(day: shown, isSelected: shown == day) { day = shown }
            }
        }
        .padding(.bottom, 6)
        .background(Theme.background)
        .feedback(self)
    }
}

private struct StrainDayPill: View {
    let day: CalendarDay
    let isSelected: Bool
    let action: () -> Void

    @Observe private var strain: Double?

    init(day: CalendarDay, isSelected: Bool, action: @escaping () -> Void) {
        self.day = day
        self.isSelected = isSelected
        self.action = action
        _strain = Observe(GarminDay.strain(on: day))
    }

    var body: some View {
        DayPill(
            day: day,
            isSelected: isSelected,
            ring: strain.map { DayRing(fraction: max(0.05, min(1, $0 / 21.0)), color: Theme.accent) },
            action: action
        )
    }
}

private struct StrainDayDetailBody: View {
    @Environment(LocalStore.self) private var store
    let day: CalendarDay
    let openPing: (Ping) -> Void

    @State private var snapshot: StrainDaySnapshot
    @State private var loadedDay: CalendarDay?

    init(day: CalendarDay, openPing: @escaping (Ping) -> Void) {
        self.day = day
        self.openPing = openPing
        _snapshot = State(initialValue: .empty(for: day))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 12) {
                    chartHeader

                    if loadedDay != day {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .frame(height: 230)
                    } else if snapshot.garmin?.stressSeries.isEmpty ?? true {
                        ContentUnavailableView(
                            "No Garmin Data",
                            systemImage: "waveform.path.ecg",
                            description: Text("Pull down to sync.")
                        )
                        .frame(height: 180)
                    } else {
                        StrainTimelineChart(snapshot: snapshot, backdrop: Theme.background, interactive: true)
                            .frame(height: 230)
                            .feedback(
                                "Strain Chart",
                                data: (day: day, strain: snapshot.garmin?.strain, activities: snapshot.activities.count, pings: snapshot.pings.count)
                            )
                    }

                    stressZoneBar
                }

                if let garmin = snapshot.garmin {
                    biometricGrid(garmin)
                }

                EmbeddedPingTimeline(day: day, history: openPing)
            }
            .padding(.horizontal, Theme.margin)
            .padding(.top, 8)
            .padding(.bottom, 30)
        }
        .scrollDismissesKeyboard(.interactively)
        .task(id: day) {
            let target = day
            if loadedDay != target {
                snapshot = .empty(for: target)
            }
            let query = StrainDaySnapshot.query(for: target)
            let observation = ValueObservation.trackingConstantRegion(query.fetch).removeDuplicates()
            do {
                for try await next in observation.values(in: store.database.pool) {
                    guard !Task.isCancelled else { break }
                    snapshot = next
                    loadedDay = target
                }
            } catch {
                if !Task.isCancelled { loadedDay = target }
            }
        }
        .refreshable {
            await GarminSync.shared.refreshIfStale(force: true)
        }
    }

    private var chartHeader: some View {
        HStack(alignment: .firstTextBaseline) {
            StatView(title: "Day Strain", value: snapshot.garmin?.strain.map { $0.formatted(.number.precision(.fractionLength(1))) } ?? "--")
                .fixedSize()
            Spacer()
            if let latest = snapshot.latestStress, let label = snapshot.stressLevelLabel {
                Text("\(latest.formatted(.number.precision(.fractionLength(1)))) · \(label)")
                    .font(AppFont.number(14))
                    .foregroundStyle(stressColor(latest))
            }
        }
    }

    private var stressZoneBar: some View {
        let total = max(1, snapshot.lowMinutes + snapshot.mediumMinutes + snapshot.highMinutes)
        return VStack(spacing: 8) {
            GeometryReader { geo in
                HStack(spacing: 2) {
                    if snapshot.lowMinutes > 0 {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color(hex: 0x46AEF0))
                            .frame(width: geo.size.width * CGFloat(snapshot.lowMinutes) / CGFloat(total))
                    }
                    if snapshot.mediumMinutes > 0 {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color(hex: 0x34D399))
                            .frame(width: geo.size.width * CGFloat(snapshot.mediumMinutes) / CGFloat(total))
                    }
                    if snapshot.highMinutes > 0 {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color(hex: 0xF59E0B))
                            .frame(width: geo.size.width * CGFloat(snapshot.highMinutes) / CGFloat(total))
                    }
                }
            }
            .frame(height: 6)

            HStack {
                zoneStat("Low", snapshot.lowMinutes, Color(hex: 0x46AEF0))
                Spacer()
                zoneStat("Medium", snapshot.mediumMinutes, Color(hex: 0x34D399))
                Spacer()
                zoneStat("High", snapshot.highMinutes, Color(hex: 0xF59E0B))
            }
        }
    }

    private func zoneStat(_ title: String, _ minutes: Int, _ color: Color) -> some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(title).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
            Text("\(minutes / 60)h \(minutes % 60)m").font(AppFont.number(12))
        }
    }

    private func biometricGrid(_ garmin: GarminDay) -> some View {
        InsightTiles(tiles: [
            InsightTile(value: garmin.restingHeartRate.map { "\($0)" } ?? "--", unit: "bpm", title: "Resting HR"),
            InsightTile(value: garmin.hrvLastNight.map { "\(Int($0.rounded()))" } ?? "--", unit: "ms", title: "HRV"),
            InsightTile(value: garmin.bodyBatteryWake.map { "\($0)" } ?? "--", title: "Body Battery"),
            InsightTile(value: garmin.sleepSeconds.map { "\($0 / 3600)h \(($0 % 3600) / 60)m" } ?? "--", title: "Sleep"),
            InsightTile(value: garmin.sleepScore.map { "\($0)" } ?? "--", title: "Sleep Score"),
            InsightTile(value: garmin.readinessScore.map { "\($0)" } ?? "--", title: "Readiness"),
        ])
    }
}
