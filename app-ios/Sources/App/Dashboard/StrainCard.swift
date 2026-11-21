import Feedback
import GRDB
import SwiftUI

/// WHOOP-style Strain & Stress chart card placed right below the Dashboard's main FocusPager carousel.
/// Uses a single `Canvas` pass (no Swift Charts overhead on Dashboard) with activity bands and Ping markers.
struct StrainDashboardCard: View {
    @Environment(LocalStore.self) private var store
    let day: CalendarDay
    @State private var snapshot: StrainDaySnapshot

    init(day: CalendarDay) {
        self.day = day
        _snapshot = State(initialValue: .empty(for: day))
    }

    var body: some View {
        NavigationLink(value: DashboardRoute.strain) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Strain & Stress")
                            .font(AppFont.headline(16))
                            .foregroundStyle(Theme.textPrimary)
                        if let garmin = snapshot.garmin {
                            Text("Synced \(garmin.syncedAt.formatted(date: .omitted, time: .shortened))")
                                .font(AppFont.rowDetail)
                                .foregroundStyle(Theme.textSecondary)
                        } else {
                            Text("Garmin CIRQA")
                                .font(AppFont.rowDetail)
                                .foregroundStyle(Theme.textSecondary)
                        }
                    }
                    Spacer()
                    if let strain = snapshot.garmin?.strain {
                        HStack(alignment: .firstTextBaseline, spacing: 4) {
                            Text(strain.formatted(.number.precision(.fractionLength(1))))
                                .font(AppFont.number(20))
                                .foregroundStyle(Theme.textPrimary)
                            Text("strain")
                                .font(AppFont.rowDetail)
                                .foregroundStyle(Theme.textSecondary)
                        }
                    }
                    Image(systemName: "chevron.forward")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.textTertiary)
                        .padding(.leading, 4)
                }

                if snapshot.garmin?.stressSeries.isEmpty ?? true {
                    HStack(spacing: 8) {
                        Image(systemName: "waveform.path.ecg")
                            .foregroundStyle(Theme.textTertiary)
                        Text("Waiting for today's Garmin sync")
                            .font(AppFont.rowDetail)
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .frame(height: 96)
                } else {
                    StrainTimelineChart(snapshot: snapshot, selectedDate: nil)
                        .frame(height: 132)
                }

                if let garmin = snapshot.garmin {
                    Divider().overlay(Theme.separator)
                    HStack(spacing: 0) {
                        miniStat("Stress", snapshot.latestStress.map { $0.formatted(.number.precision(.fractionLength(1))) } ?? "--", tint: stressColor(snapshot.latestStress ?? 1))
                        miniStat("RHR", garmin.restingHeartRate.map { "\($0)" } ?? "--")
                        miniStat("HRV", garmin.hrvLastNight.map { "\(Int($0.rounded())) ms" } ?? "--")
                        miniStat("BB", garmin.bodyBatteryWake.map { "\($0)" } ?? "--")
                    }
                }
            }
            .card()
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Theme.margin)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Strain and Stress")
        .task(id: day) {
            let query = StrainDaySnapshot.query(for: day)
            let observation = ValueObservation.trackingConstantRegion(query.fetch).removeDuplicates()
            do {
                for try await next in observation.values(in: store.database.pool) {
                    guard !Task.isCancelled else { break }
                    snapshot = next
                }
            } catch {}
        }
        .feedback(self)
    }

    private func miniStat(_ label: String, _ value: String, tint: Color = Theme.textPrimary) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(AppFont.caption())
                .foregroundStyle(Theme.textSecondary)
            Text(value)
                .font(AppFont.number(14))
                .foregroundStyle(tint)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Shared high-performance `Canvas` chart for both the Dashboard card and the interactive Detail view.
/// Draws the 0.0–3.0 WHOOP-style stress curve, activity/sleep bands, ping pins, and optional scrubbing cursor.
struct StrainTimelineChart: View {
    let snapshot: StrainDaySnapshot
    let selectedDate: Date?

    var body: some View {
        let points = snapshot.garmin?.stressSeries ?? []
        let start = snapshot.windowStart.timeIntervalSince1970
        let end = max(start + 3600, snapshot.windowEnd.timeIntervalSince1970)
        let span = end - start

        ZStack(alignment: .topLeading) {
            Canvas { context, size in
                let leftPad: CGFloat = 26
                let rightPad: CGFloat = 6
                let topPad: CGFloat = 20
                let bottomPad: CGFloat = 18
                let plotW = max(1, size.width - leftPad - rightPad)
                let plotH = max(1, size.height - topPad - bottomPad)

                func xOf(_ epoch: Double) -> CGFloat {
                    leftPad + CGFloat(min(1, max(0, (epoch - start) / span))) * plotW
                }
                func yOf(_ stress: Double) -> CGFloat {
                    topPad + CGFloat(1 - min(3, max(0, stress)) / 3) * plotH
                }

                // Horizontal gridlines (0, 1, 2, 3)
                for level in 0...3 {
                    let y = yOf(Double(level))
                    var grid = Path()
                    grid.move(to: CGPoint(x: leftPad, y: y))
                    grid.addLine(to: CGPoint(x: size.width - rightPad, y: y))
                    context.stroke(grid, with: .color(Theme.separator.opacity(0.6)), lineWidth: 0.75)

                    let label = Text("\(level).0").font(.system(size: 9, weight: .medium, design: .rounded)).foregroundStyle(Theme.textTertiary)
                    context.draw(label, at: CGPoint(x: 11, y: y), anchor: .center)
                }

                // Activity & sleep bands
                for band in snapshot.activities {
                    let x1 = xOf(band.start.timeIntervalSince1970)
                    let x2 = max(x1 + 3, xOf(band.end.timeIntervalSince1970))
                    let fill: Color = band.kind == .sleep ? Color(hex: 0x94A3B8) : Color(hex: 0x3B82F6)
                    let rect = CGRect(x: x1, y: topPad, width: x2 - x1, height: plotH)
                    context.fill(Path(rect), with: .color(fill.opacity(band.kind == .sleep ? 0.12 : 0.18)))

                    var cap = Path()
                    cap.move(to: CGPoint(x: x1, y: topPad))
                    cap.addLine(to: CGPoint(x: x2, y: topPad))
                    context.stroke(cap, with: .color(fill), style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                }

                // Ping vertical marker pins
                for ping in snapshot.pings {
                    let x = xOf(ping.at.timeIntervalSince1970)
                    let color = ping.color.swatch
                    var line = Path()
                    line.move(to: CGPoint(x: x, y: topPad + 2))
                    line.addLine(to: CGPoint(x: x, y: topPad + plotH))
                    context.stroke(line, with: .color(color.opacity(0.55)), style: StrokeStyle(lineWidth: 1, dash: [2, 2]))

                    let dot = CGRect(x: x - 3.5, y: topPad + plotH - 3.5, width: 7, height: 7)
                    context.fill(Path(ellipseIn: dot), with: .color(color))
                }

                // Stress curve with WHOOP-style vertical gradient (sky blue -> emerald -> amber)
                if points.count >= 2 {
                    var curve = Path()
                    var prevEpoch: Double?
                    for pt in points {
                        let p = CGPoint(x: xOf(pt.epochSec), y: yOf(pt.value))
                        if let prev = prevEpoch, pt.epochSec - prev <= 15 * 60 {
                            curve.addLine(to: p)
                        } else {
                            curve.move(to: p)
                        }
                        prevEpoch = pt.epochSec
                    }
                    let gradient = Gradient(stops: [
                        .init(color: Color(hex: 0xF59E0B), location: 0.0),
                        .init(color: Color(hex: 0xA3E635), location: 0.28),
                        .init(color: Color(hex: 0x34D399), location: 0.58),
                        .init(color: Color(hex: 0x46AEF0), location: 1.0),
                    ])
                    context.stroke(
                        curve,
                        with: .linearGradient(gradient, startPoint: CGPoint(x: 0, y: topPad), endPoint: CGPoint(x: 0, y: topPad + plotH)),
                        style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round)
                    )
                }

                // Time ticks along bottom
                for i in 0...3 {
                    let frac = Double(i) / 3.0
                    let epoch = start + frac * span
                    let x = xOf(epoch)
                    let text = Date(timeIntervalSince1970: epoch).formatted(.dateTime.hour().minute())
                    let anchor: UnitPoint = i == 0 ? .leading : (i == 3 ? .trailing : .center)
                    context.draw(
                        Text(text).font(.system(size: 9, weight: .medium)).foregroundStyle(Theme.textTertiary),
                        at: CGPoint(x: x, y: size.height - 6),
                        anchor: anchor
                    )
                }

                // Scrubbing cursor
                if let selectedDate {
                    let x = xOf(selectedDate.timeIntervalSince1970)
                    var cursor = Path()
                    cursor.move(to: CGPoint(x: x, y: topPad))
                    cursor.addLine(to: CGPoint(x: x, y: topPad + plotH))
                    context.stroke(cursor, with: .color(Theme.textPrimary.opacity(0.85)), lineWidth: 1.2)
                }
            }

            // Activity icons positioned along the top rail
            GeometryReader { geo in
                let leftPad: CGFloat = 26
                let rightPad: CGFloat = 6
                let plotW = max(1, geo.size.width - leftPad - rightPad)
                ForEach(snapshot.activities) { band in
                    let mid = (band.start.timeIntervalSince1970 + band.end.timeIntervalSince1970) / 2
                    let frac = min(1, max(0, (mid - start) / span))
                    Image(systemName: band.symbol)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(band.kind == .sleep ? Color(hex: 0xCBD5E1) : Color(hex: 0x60A5FA))
                        .position(x: leftPad + CGFloat(frac) * plotW, y: 9)
                }
            }
            .allowsHitTesting(false)
        }
    }
}

func stressColor(_ value: Double) -> Color {
    if value < 1.0 { return Color(hex: 0x46AEF0) }
    if value < 2.0 { return Color(hex: 0x34D399) }
    return Color(hex: 0xF59E0B)
}
