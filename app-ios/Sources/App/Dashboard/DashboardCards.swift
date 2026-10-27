import SwiftUI

struct DashboardCard<Chart: View>: View {
    let title: String
    let period: String
    let value: String?
    let unit: String
    @ViewBuilder let chart: Chart

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title).font(AppFont.headline(16)).lineLimit(1)
            Text(period).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
            chart
                .frame(height: 50)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
            Divider().overlay(Theme.separator)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(value ?? "--").font(AppFont.number(17))
                Text(unit).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                Spacer(minLength: 0)
                Image(systemName: "chevron.forward").font(.caption.weight(.semibold)).foregroundStyle(Theme.textTertiary)
            }
            .padding(.top, 10)
        }
        .card()
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
    }
}

/// Drawn rather than charted: a Swift Charts chart per card costs a layout pass of its own on every dashboard render.
struct MiniBars: View {
    let values: [Double]
    let color: Color

    var body: some View {
        Canvas { context, size in
            guard !values.isEmpty else { return }
            let top = max(values.max() ?? 0, 1)
            let band = size.width / CGFloat(values.count)
            for (index, value) in values.enumerated() {
                let height = size.height * value / top
                let bar = CGRect(x: band * (CGFloat(index) + 0.15), y: size.height - height, width: band * 0.7, height: height)
                context.fill(RoundedRectangle(cornerRadius: 2).path(in: bar), with: .color(color))
            }
        }
    }
}

struct MiniLine: View {
    let values: [Double]
    let color: Color
    var rightAlignedSlots = 7
    var showsPoints = true

    var body: some View {
        Canvas { context, size in
            let offset = max(rightAlignedSlots - values.count, 0)
            let low = values.min() ?? 0
            let high = values.max() ?? 1
            let pad = max((high - low) * 0.15, 0.5)
            let x = (low: -0.3, high: Double(rightAlignedSlots - 1) + 0.3)
            let y = (low: low - pad, high: high + pad)
            let points = values.enumerated().map { index, value in
                CGPoint(
                    x: size.width * (Double(index + offset) - x.low) / (x.high - x.low),
                    y: size.height * (1 - (value - y.low) / (y.high - y.low))
                )
            }
            var line = Path()
            line.addLines(points)
            context.stroke(line, with: .color(color), style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
            // Swift Charts' symbol size 30 is an area: a 5.5 pt circle with its 1.5 pt border inside it.
            let radius = 30.squareRoot() / 2 - 0.75
            for point in points where showsPoints {
                let dot = Path(ellipseIn: CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2))
                context.stroke(dot, with: .color(color), lineWidth: 1.5)
            }
        }
    }
}

struct DotGrid: View {
    let days: [Bool]
    let color: Color

    var body: some View {
        // Each dot centers in a flexible column, so ten fit a half-width card at any screen size.
        Grid(horizontalSpacing: 0, verticalSpacing: 6) {
            ForEach(0..<3, id: \.self) { row in
                GridRow {
                    ForEach(0..<10, id: \.self) { column in
                        let index = row * 10 + column
                        RoundedRectangle(cornerRadius: 2)
                            .fill(days.indices.contains(index) && days[index] ? color : Theme.surfaceRaised)
                            .frame(width: 9, height: 9)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
        }
    }
}

struct CycleRingsCard: View {
    let progress: DashboardMetrics.CycleProgress
    let hasProgram: Bool
    @Binding var scope: DashboardMetrics.CycleScope

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(hasProgram ? "Cycle Workouts" : "Weekly Workouts").font(AppFont.title())
            HStack(alignment: .top) {
                ring("Muscles", progress.muscles, size: 78, color: Theme.muscle)
                Spacer()
                ring("Sets", progress.sets, size: 128, color: Theme.accent)
                Spacer()
                ring("Exercises", progress.exercises, size: 78, color: DashboardColor.exercise)
            }
            if hasProgram {
                Picker("Count", selection: $scope) {
                    ForEach(DashboardMetrics.CycleScope.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 260)
                .frame(maxWidth: .infinity)
            }
        }
    }

    private func ring(_ title: String, _ ring: DashboardMetrics.Ring, size: CGFloat, color: Color) -> some View {
        VStack(spacing: 10) {
            ZStack {
                Circle().stroke(Theme.surfaceRaised, lineWidth: 5)
                if let target = ring.target, target > 0 {
                    Circle()
                        .trim(from: 0, to: min(Double(ring.done) / Double(target), 1))
                        .stroke(color, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                }
                VStack(spacing: 0) {
                    Text("\(ring.done)").font(AppFont.number(size > 100 ? 22 : 18))
                    if let left = ring.left {
                        Text("\(left) left").font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                    }
                }
            }
            .frame(width: size, height: size)
            .frame(height: 128)
            VStack(spacing: 2) {
                Text(title).font(AppFont.headline(15))
                Text(ring.target.map { "\($0) target" } ?? "done").font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

struct RecentRecordsCard: View {
    let records: [RecordRow]
    @Binding var kind: ExerciseRecord.Kind

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Recent Records").font(AppFont.title())
            if records.isEmpty {
                Text("Finish a workout to set records.")
                    .font(AppFont.caption(14))
                    .foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity, minHeight: 190)
            } else {
                VStack(spacing: 10) {
                    ForEach(records, id: \.exerciseID) { record in
                        HStack(spacing: 8) {
                            Text(record.name).font(AppFont.caption(12)).lineLimit(1).frame(width: 96, alignment: .leading)
                            RecordBar(fraction: record.fraction) {
                                Capsule().fill(DashboardColor.records)
                                Text(record.label).font(AppFont.caption(12)).lineLimit(1).fixedSize()
                            }
                        }
                        .frame(height: 18)
                        .accessibilityElement(children: .combine)
                    }
                }
                .frame(minHeight: 190, alignment: .top)
            }
            Picker("Record", selection: $kind) {
                Text("Volume").tag(ExerciseRecord.Kind.volume)
                Text("Reps").tag(ExerciseRecord.Kind.reps)
                Text("1-RM").tag(ExerciseRecord.Kind.oneRepMax)
            }
            .pickerStyle(.segmented)
            .frame(maxWidth: 260)
            .frame(maxWidth: .infinity)
        }
    }
}

/// The bar spans 72% of the row's remaining width at the record's fraction, with its label after it; one layout instead
/// of a `GeometryReader` per row.
private struct RecordBar: Layout {
    var fraction: Double

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        proposal.replacingUnspecifiedDimensions()
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let width = max(bounds.width * 0.72 * fraction, 4)
        subviews[0].place(at: CGPoint(x: bounds.minX, y: bounds.midY), anchor: .leading, proposal: ProposedViewSize(width: width, height: 8))
        subviews[1].place(at: CGPoint(x: bounds.minX + width + 6, y: bounds.midY), anchor: .leading, proposal: .unspecified)
    }
}
