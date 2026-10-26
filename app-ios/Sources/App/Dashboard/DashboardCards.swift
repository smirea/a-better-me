import Charts
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
        .padding(14)
        .background(Theme.surface, in: .rect(cornerRadius: Theme.cornerRadius))
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
    }
}

struct MiniBars: View {
    let values: [Double]
    let color: Color

    var body: some View {
        Chart(Array(values.enumerated()), id: \.offset) { index, value in
            BarMark(x: .value("Index", "\(index)"), y: .value("Value", value), width: .ratio(0.7))
                .foregroundStyle(color)
                .clipShape(.rect(cornerRadius: 2))
        }
        .chartYScale(domain: 0...max(values.max() ?? 0, 1))
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
    }
}

struct MiniLine: View {
    let values: [Double]
    let color: Color
    var rightAlignedSlots = 7
    var showsPoints = true

    var body: some View {
        let offset = max(rightAlignedSlots - values.count, 0)
        let low = values.min() ?? 0
        let high = values.max() ?? 1
        let pad = max((high - low) * 0.15, 0.5)
        Chart(Array(values.enumerated()), id: \.offset) { index, value in
            LineMark(x: .value("Index", index + offset), y: .value("Value", value))
                .foregroundStyle(color)
            if showsPoints {
                PointMark(x: .value("Index", index + offset), y: .value("Value", value))
                    .symbol(.circle.strokeBorder(lineWidth: 1.5))
                    .symbolSize(30)
                    .foregroundStyle(color)
            }
        }
        .chartXScale(domain: -0.3...Double(rightAlignedSlots - 1) + 0.3)
        .chartYScale(domain: (low - pad)...(high + pad))
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
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
    let records: [DashboardMetrics.RecentRecord]
    let label: (Double) -> String
    let name: (ExerciseID) -> String
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
                let top = records.map(\.value).max() ?? 1
                VStack(spacing: 10) {
                    ForEach(records, id: \.exerciseID) { record in
                        HStack(spacing: 8) {
                            Text(name(record.exerciseID)).font(AppFont.caption(12)).lineLimit(1).frame(width: 96, alignment: .leading)
                            GeometryReader { proxy in
                                HStack(spacing: 6) {
                                    Capsule().fill(DashboardColor.records)
                                        .frame(width: max(proxy.size.width * 0.72 * record.value / top, 4), height: 8)
                                    Text(label(record.value)).font(AppFont.caption(12)).lineLimit(1).fixedSize()
                                }
                                .frame(maxHeight: .infinity)
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
