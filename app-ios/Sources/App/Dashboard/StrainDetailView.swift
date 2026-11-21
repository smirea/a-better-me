import Feedback
import GRDB
import SwiftUI

/// Full Strain & Stress detail view with day navigation, interactive chart scrubbing, daily recovery/biometric stats,
/// and a truncated chronological timeline of the day's activities and pings.
struct StrainDetailView: View {
    @State private var day = CalendarDay.today
    @State private var selectedDate: Date?

    var body: some View {
        StrainDayDetailBody(day: $day, selectedDate: $selectedDate)
            .detailTitle("Strain & Stress")
            .background(Theme.background)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if day != .today {
                        Button("Today") {
                            selectedDate = nil
                            day = .today
                        }
                        .accessibilityLabel("Jump to Today")
                    }
                }
            }
            .feedback(self)
    }
}

private struct StrainTimelineRow: Identifiable, Hashable {
    var id: String
    var at: Date
    var icon: String
    var tint: Color
    var title: String
    var subtitle: String
}

private struct StrainDayDetailBody: View {
    @Environment(LocalStore.self) private var store
    @Binding var day: CalendarDay
    @Binding var selectedDate: Date?
    @State private var snapshot: StrainDaySnapshot
    @State private var loadedDay: CalendarDay?

    init(day: Binding<CalendarDay>, selectedDate: Binding<Date?>) {
        _day = day
        _selectedDate = selectedDate
        _snapshot = State(initialValue: .empty(for: day.wrappedValue))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                dayNavigator

                VStack(alignment: .leading, spacing: 12) {
                    calloutHeader

                    if loadedDay != day {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .frame(height: 210)
                    } else if snapshot.garmin?.stressSeries.isEmpty ?? true {
                        ContentUnavailableView(
                            "No Garmin Data",
                            systemImage: "waveform.path.ecg",
                            description: Text("Pull down to sync or open Garmin Connect to upload from your band.")
                        )
                        .frame(height: 180)
                    } else {
                        GeometryReader { geo in
                            StrainTimelineChart(snapshot: snapshot, selectedDate: selectedDate)
                                .contentShape(.rect)
                                .gesture(
                                    DragGesture(minimumDistance: 0)
                                        .onChanged { value in
                                            let leftPad: CGFloat = 26
                                            let rightPad: CGFloat = 6
                                            let plotW = max(1, geo.size.width - leftPad - rightPad)
                                            let frac = min(1, max(0, Double((value.location.x - leftPad) / plotW)))
                                            let start = snapshot.windowStart.timeIntervalSince1970
                                            let span = max(3600, snapshot.windowEnd.timeIntervalSince1970 - start)
                                            selectedDate = Date(timeIntervalSince1970: start + frac * span)
                                        }
                                        .onEnded { _ in selectedDate = nil }
                                )
                        }
                        .frame(height: 210)
                    }

                    stressZoneBar
                }
                .card()

                if let garmin = snapshot.garmin {
                    biometricGrid(garmin)
                }

                let items = mergedTimelineItems()
                if !items.isEmpty {
                    TruncatedList("Activities & Pings", items: items) { item in
                        StrainTimelineRowView(item: item)
                            .padding(.horizontal, 16)
                    } destination: {
                        StrainTimelineAllView(subtitle: formattedDay(day), items: items)
                    }
                }
            }
            .padding(.horizontal, Theme.margin)
            .padding(.bottom, 30)
        }
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

    private var dayNavigator: some View {
        HStack {
            Button {
                selectedDate = nil
                day = day.adding(days: -1)
            } label: {
                Image(systemName: "chevron.left")
                    .font(.body.weight(.semibold))
                    .frame(width: 36, height: 36)
            }
            .accessibilityLabel("Previous Day")

            Spacer()
            Text(formattedDay(day))
                .font(AppFont.headline(16))
            Spacer()

            Button {
                selectedDate = nil
                day = day.adding(days: 1)
            } label: {
                Image(systemName: "chevron.right")
                    .font(.body.weight(.semibold))
                    .frame(width: 36, height: 36)
            }
            .disabled(day >= .today)
            .opacity(day >= .today ? 0.3 : 1)
            .accessibilityLabel("Next Day")
        }
        .padding(.horizontal, 4)
    }

    @ViewBuilder
    private var calloutHeader: some View {
        if let selectedDate, let point = nearestStress(to: selectedDate) {
            let hr = nearestHR(to: selectedDate)
            HStack(alignment: .firstTextBaseline) {
                Text(point.value.formatted(.number.precision(.fractionLength(2))))
                    .font(AppFont.number(26))
                    .foregroundStyle(stressColor(point.value))
                Text(selectedDate.formatted(date: .omitted, time: .shortened))
                    .font(AppFont.rowDetail)
                    .foregroundStyle(Theme.textSecondary)
                Spacer()
                if let hr {
                    Text("\(Int(hr.value.rounded())) bpm")
                        .font(AppFont.number(16))
                        .foregroundStyle(Theme.textPrimary)
                }
            }
        } else {
            HStack(alignment: .firstTextBaseline) {
                if let strain = snapshot.garmin?.strain {
                    Text(strain.formatted(.number.precision(.fractionLength(1))))
                        .font(AppFont.number(26))
                    Text("Day Strain")
                        .font(AppFont.rowDetail)
                        .foregroundStyle(Theme.textSecondary)
                } else {
                    Text("--")
                        .font(AppFont.number(26))
                    Text("Day Strain")
                        .font(AppFont.rowDetail)
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                if let latest = snapshot.latestStress, let label = snapshot.stressLevelLabel {
                    Text("\(latest.formatted(.number.precision(.fractionLength(1)))) · \(label)")
                        .font(AppFont.number(14))
                        .foregroundStyle(stressColor(latest))
                }
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
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            statTile("Resting HR", garmin.restingHeartRate.map { "\($0) bpm" } ?? "--")
            statTile("HRV", garmin.hrvLastNight.map { "\(Int($0.rounded())) ms" } ?? "--")
            statTile("Body Battery", garmin.bodyBatteryWake.map { "\($0)" } ?? "--")
            statTile("Sleep", garmin.sleepSeconds.map { "\($0 / 3600)h \(($0 % 3600) / 60)m" } ?? "--")
            statTile("Sleep Score", garmin.sleepScore.map { "\($0)" } ?? "--")
            statTile("Readiness", garmin.readinessScore.map { "\($0)" } ?? "--")
        }
    }

    private func statTile(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value).font(AppFont.number(17))
            Text(title).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private func mergedTimelineItems() -> [StrainTimelineRow] {
        var rows: [StrainTimelineRow] = []
        for band in snapshot.activities {
            var sub = band.detail
            if let strain = band.strain {
                sub += (sub.isEmpty ? "" : " · ") + "Strain \(strain.formatted(.number.precision(.fractionLength(1))))"
            }
            rows.append(StrainTimelineRow(
                id: "act-\(band.id)",
                at: band.start,
                icon: band.symbol,
                tint: band.kind == .sleep ? Color(hex: 0x94A3B8) : Color(hex: 0x3B82F6),
                title: band.title,
                subtitle: sub
            ))
        }
        for ping in snapshot.pings {
            let parts = [ping.valueText, ping.note.isEmpty ? nil : ping.note].compactMap { $0 }
            rows.append(StrainTimelineRow(
                id: "ping-\(ping.id.uuidString)",
                at: ping.at,
                icon: ping.icon,
                tint: ping.color.swatch,
                title: ping.name,
                subtitle: parts.joined(separator: " · ")
            ))
        }
        return rows.sorted { $0.at < $1.at }
    }

    private func nearestStress(to date: Date) -> GarminSeriesPoint? {
        let target = date.timeIntervalSince1970
        return snapshot.garmin?.stressSeries.min { abs($0.epochSec - target) < abs($1.epochSec - target) }
    }

    private func nearestHR(to date: Date) -> GarminSeriesPoint? {
        let target = date.timeIntervalSince1970
        return snapshot.garmin?.heartRateSeries.min { abs($0.epochSec - target) < abs($1.epochSec - target) }
    }

    private func formattedDay(_ day: CalendarDay) -> String {
        if day == .today { return "Today" }
        if day == CalendarDay.today.adding(days: -1) { return "Yesterday" }
        return day.date(in: .current).formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    }
}

private struct StrainTimelineRowView: View {
    let item: StrainTimelineRow

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: item.icon)
                .font(.body.weight(.semibold))
                .foregroundStyle(item.tint)
                .frame(width: 28, height: 28)
                .background(item.tint.opacity(0.16), in: RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(AppFont.headline(14))
                    .foregroundStyle(Theme.textPrimary)
                if !item.subtitle.isEmpty {
                    Text(item.subtitle)
                        .font(AppFont.rowDetail)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            Spacer()
            Text(item.at.formatted(date: .omitted, time: .shortened))
                .font(AppFont.rowDetail)
                .foregroundStyle(Theme.textTertiary)
        }
        .padding(.vertical, 10)
    }
}

private struct StrainTimelineAllView: View {
    let subtitle: String
    let items: [StrainTimelineRow]

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    StrainTimelineRowView(item: item)
                        .padding(.horizontal, 16)
                        .overlay(alignment: .top) {
                            if index > 0 { Divider().overlay(Theme.separator) }
                        }
                }
            }
            .background(Theme.surface, in: .rect(cornerRadius: Theme.cornerRadius))
            .padding(.horizontal, Theme.margin)
            .padding(.bottom, 30)
        }
        .background(Theme.background)
        .detailTitle("Activities & Pings", subtitle: subtitle)
        .feedback(self)
    }
}
