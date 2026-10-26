import Charts
import SwiftUI

struct MetricDetailView: View {
    let route: DashboardRoute
    var initialTab: String?

    var body: some View {
        DashboardDataReader { data in
            MetricDetailContent(detail: data.detail(route), data: data, route: route, initialTab: initialTab)
        }
    }
}

private struct MetricDetailContent: View {
    let detail: MetricDetail
    let data: DashboardData
    let route: DashboardRoute
    let initialTab: String?

    @Environment(LocalStore.self) private var store
    @State private var tabID: String?
    @State private var range = ChartRange.oneWeek
    @State private var averaging = Averaging.daily
    @State private var fitOverrides: [MetricTab.ID: Bool] = [:]
    @State private var loggingWeight = false
    @State private var shownExercise: ShownExercise?

    private var fitToData: Bool { fitOverrides[tab.id] ?? (tab.style == .line) }

    private var tab: MetricTab {
        detail.tabs.first { $0.id == (tabID ?? initialTab) } ?? detail.tabs[0]
    }

    var body: some View {
        let interval = range.interval(endingAt: data.now, earliest: tab.points.first?.date, calendar: data.calendar)
        let daily = tab.points.inside(interval)
        // A week or month that began before the range is drawn at the range's start, inside the chart.
        let plotted = averaging.bucket(daily, calendar: data.calendar).map { DatedValue(date: max($0.date, interval.start), value: $0.value) }
        let overlay = tab.overlay.map { averaging.bucket($0.points.inside(interval), calendar: data.calendar).map { DatedValue(date: max($0.date, interval.start), value: $0.value) } } ?? []
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if detail.tabs.count > 1 { tabStrip }
                summary(stats: tab.stats?(interval) ?? [
                    MetricTab.Stat(title: tab.averageTitle, value: plotted.average),
                    MetricTab.Stat(title: tab.summary.title(tab.title), value: tab.summary.second(of: daily.map(\.value))),
                ], interval: interval)
                    .padding(.horizontal, 20)
                chart(plotted, overlay: overlay, interval: interval)
                    .frame(height: 320)
                    .padding(.horizontal, 20)
                controls.padding(.horizontal, 20)
                legend.padding(.horizontal, 20)
                footer.padding(.horizontal, 20)
            }
            .padding(.bottom, 30)
        }
        .background(Theme.background)
        .navigationTitle(detail.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if route == .scaleWeight || route == .weightTrend {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Log Weight", systemImage: "plus") { loggingWeight = true }
                }
            }
        }
        .sheet(isPresented: $loggingWeight) { BodyWeightLogSheet() }
        .sheet(item: $shownExercise) { ExerciseDetailSheet(exerciseID: $0.id) }
    }

    private var tabStrip: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 0) {
                ForEach(detail.tabs) { item in
                    let selected = item.id == tab.id
                    Button { tabID = item.id } label: {
                        Label {
                            Text(item.title)
                        } icon: {
                            if let icon = item.icon { Image(systemName: icon) }
                        }
                        .font(AppFont.medium(15))
                        .foregroundStyle(selected ? Theme.textPrimary : Theme.textSecondary)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .frame(minWidth: detail.tabs.count == 2 ? 180 : nil)
                        .overlay(alignment: .bottom) {
                            Rectangle().fill(selected ? Theme.textPrimary : Theme.separator).frame(height: 2)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
        }
        .scrollIndicators(.hidden)
    }

    /// The average is over the plotted points, so it follows the averaging. Totals, bests, and change are over the
    /// range's days, which averaging would distort.
    private func summary(stats: [MetricTab.Stat], interval: DateInterval) -> some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .top, spacing: 40) {
                    ForEach(stats, id: \.title) { stat($0.title, $0.value) }
                }
                Text(Self.rangeLabel(interval, calendar: data.calendar))
                    .font(AppFont.caption(14))
                    .foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            Button { fitOverrides[tab.id] = !fitToData } label: {
                Image(systemName: fitToData ? "arrow.down.and.line.horizontal.and.arrow.up" : "arrow.up.and.line.horizontal.and.arrow.down")
            }
            .buttonStyle(.glass)
            .buttonBorderShape(.circle)
            .accessibilityLabel(fitToData ? "Scale from zero" : "Fit to data")
        }
    }

    private func stat(_ title: String, _ value: Double?) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(value.map(format) ?? "--").font(AppFont.number(22))
                Text(tab.unit).font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func format(_ value: Double) -> String {
        tab.unit == "steps" || tab.unit == "kcal" ? Int(value.rounded()).formatted() : value.dashboardText
    }

    private func chart(_ points: [DatedValue], overlay: [DatedValue], interval: DateInterval) -> some View {
        let values = (points + overlay).map(\.value)
        let high = max(values.max() ?? 0, 1)
        let low = fitToData ? values.min() ?? 0 : 0
        let pad = fitToData ? max((high - low) * 0.1, 0.5) : high * 0.1
        return Chart {
            if let line = tab.overlay {
                ForEach(overlay, id: \.date) { point in
                    LineMark(x: .value("Date", point.date), y: .value(line.title, point.value), series: .value("Series", line.title))
                        .foregroundStyle(line.color)
                        .lineStyle(StrokeStyle(lineWidth: line.dashed ? 1.5 : 2, dash: line.dashed ? [2, 3] : []))
                }
            }
            ForEach(points, id: \.date) { point in
                switch tab.style {
                case .bar:
                    BarMark(x: .value("Date", point.date, unit: averaging.component), y: .value(tab.title, point.value))
                        .foregroundStyle(tab.color)
                case .line:
                    LineMark(x: .value("Date", point.date), y: .value(tab.title, point.value), series: .value("Series", tab.title))
                        .foregroundStyle(tab.color)
                    if points.count < 15 {
                        PointMark(x: .value("Date", point.date), y: .value(tab.title, point.value))
                            .symbol(.circle.strokeBorder(lineWidth: 1.5))
                            .foregroundStyle(tab.color)
                    } else if averaging == .daily, tab.holding.contains(point.date) {
                        PointMark(x: .value("Date", point.date), y: .value(tab.title, point.value))
                            .symbol(.square.strokeBorder(lineWidth: 1))
                            .symbolSize(18)
                            .foregroundStyle(tab.color)
                    }
                }
            }
        }
        .chartXScale(domain: interval.start...interval.end)
        .chartYScale(domain: max(low - pad, fitToData ? -.infinity : 0)...(high + pad))
        .chartYAxis {
            AxisMarks(position: .trailing) { _ in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [3, 3])).foregroundStyle(Theme.separator)
                AxisValueLabel().foregroundStyle(Theme.textSecondary)
            }
        }
        .chartXAxis {
            AxisMarks(values: .automatic(desiredCount: range == .oneWeek ? 7 : 5)) { _ in
                AxisValueLabel(format: range == .oneWeek ? .dateTime.weekday(.abbreviated) : .dateTime.month(.abbreviated).day())
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        .accessibilityLabel("\(tab.title) chart")
    }

    private var controls: some View {
        HStack(spacing: 10) {
            Picker("Range", selection: $range) {
                ForEach(ChartRange.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            Menu {
                Picker("Chart Averaging", selection: $averaging) {
                    ForEach(Averaging.allCases) { Text($0.title).tag($0) }
                }
            } label: {
                HStack(spacing: 4) {
                    Text(averaging.rawValue)
                    Image(systemName: "chevron.down").font(.caption2.weight(.bold))
                }
                .font(AppFont.medium(14))
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
            }
            .buttonStyle(.glass)
            .accessibilityLabel("Chart Averaging")
            .accessibilityValue(averaging.title)
        }
    }

    private var legend: some View {
        HStack(spacing: 20) {
            if let overlay = tab.overlay, !overlay.dashed {
                legendItem(overlay.title, symbol: "point.topleft.down.to.point.bottomright.curvepath", color: overlay.color)
            }
            legendItem(tab.style == .bar && tab.overlay != nil ? "Calories" : tab.title, symbol: tab.style == .bar ? "chart.bar.fill" : "point.topleft.down.to.point.bottomright.curvepath", color: tab.color)
            if let overlay = tab.overlay, overlay.dashed {
                legendItem(overlay.title, symbol: "line.horizontal.3", color: overlay.color)
            }
            if !tab.holding.isEmpty {
                legendItem("Holding", symbol: "square", color: tab.color)
            }
        }
        .font(AppFont.medium(14))
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Theme.surface, in: .rect(cornerRadius: Theme.smallCornerRadius))
    }

    private func legendItem(_ title: String, symbol: String, color: Color) -> some View {
        Label {
            Text(title)
        } icon: {
            Image(systemName: symbol).foregroundStyle(color)
        }
    }

    @ViewBuilder
    private var footer: some View {
        switch detail.footer {
        case .months:
            MonthList(rows: tab.points.reversed().map { MonthRow(date: $0.date, text: "\(format($0.value)) \(tab.unit)") }, calendar: data.calendar)
        case .expenditure:
            ExpenditureInsights(data: data)
            MonthList(rows: tab.points.reversed().map { point in
                MonthRow(date: point.date, text: "\(format(point.value)) \(tab.unit)", tag: tab.holding.contains(point.date) ? MonthRow.Tag(text: "Holding", symbol: "square", color: tab.color) : nil)
            }, calendar: data.calendar)
        case .weightTrend:
            WeightTrendInsights(data: data)
            MonthList(rows: tab.points.reversed().map { MonthRow(date: $0.date, text: "\(format($0.value)) \(tab.unit)") }, calendar: data.calendar)
        case .energyBalance:
            EnergyBalanceInsights(data: data, tab: tab)
        case let .weighIns(weighIns):
            MonthList(rows: weighIns.map { weighIn in
                MonthRow(date: weighIn.date, text: "\(data.unit.format(kg: weighIn.kg)) \(data.unit.rawValue)", detail: weighIn.source == .health ? "Health" : nil, source: weighIn.source)
            }, calendar: data.calendar, showsTime: true) { store.delete(BodyWeight.self, id: $0) }
        case let .topExercises(top):
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Top 5 Exercises by Sets").font(AppFont.title())
                    Text("Last 30 Days").font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
                }
                VStack(spacing: 0) {
                    ForEach(Array(top.enumerated()), id: \.element.exerciseID) { index, entry in
                        if index > 0 { Divider().overlay(Theme.separator).padding(.leading, 76) }
                        Button { shownExercise = ShownExercise(id: entry.exerciseID) } label: {
                            TopExerciseRow(exercise: data.catalog(entry.exerciseID), sets: entry.sets)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .background(Theme.surface, in: .rect(cornerRadius: Theme.cornerRadius))
            }
        }
    }

    static func rangeLabel(_ interval: DateInterval, calendar: Calendar) -> String {
        let last = calendar.date(byAdding: .day, value: -1, to: interval.end)!
        return (interval.start..<last.addingTimeInterval(1)).formatted(.interval.month(.abbreviated).day().year())
    }
}

private struct TopExerciseRow: View {
    let exercise: Exercise?
    let sets: Int

    var body: some View {
        HStack(spacing: 14) {
            if let exercise {
                ExerciseImage(exercise: exercise)
                    .frame(width: 34, height: 50)
                    .clipShape(.rect(cornerRadius: 6))
            }
            Text(exercise?.name ?? "Unknown exercise").font(AppFont.headline(15)).lineLimit(2)
            Spacer()
            Text("\(sets) \(sets == 1 ? "set" : "sets")").font(AppFont.body(15))
            Image(systemName: "chevron.forward").font(.footnote.weight(.semibold)).foregroundStyle(Theme.textTertiary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .contentShape(.rect)
    }
}

private struct ShownExercise: Identifiable {
    let id: ExerciseID
}

struct MonthRow: Identifiable {
    struct Tag {
        var text: String
        var symbol: String
        var color: Color
    }

    var date: Date
    var text: String
    var detail: String?
    var source: WeighIn.Source?
    var tag: Tag?

    var id: String { "\(date.timeIntervalSince1970) \(text)" }
}

struct MonthList: View {
    let rows: [MonthRow]
    let calendar: Calendar
    var showsTime = false
    var delete: ((UUID) -> Void)?

    var body: some View {
        let months = Dictionary(grouping: rows) { calendar.dateInterval(of: .month, for: $0.date)!.start }
        VStack(alignment: .leading, spacing: 20) {
            ForEach(months.keys.sorted(by: >), id: \.self) { month in
                VStack(alignment: .leading, spacing: 10) {
                    Text(month.formatted(.dateTime.month(.wide).year())).font(AppFont.title())
                    VStack(spacing: 0) {
                        ForEach(Array(months[month]!.enumerated()), id: \.element.id) { index, row in
                            if index > 0 { Divider().overlay(Theme.separator) }
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(row.text).font(AppFont.headline(15))
                                    Text([showsTime ? row.date.formatted(.dateTime.weekday().month().day().hour().minute()) : row.date.formatted(.dateTime.weekday().month().day()), row.detail].compactMap { $0 }.joined(separator: " · "))
                                        .font(AppFont.caption(13))
                                        .foregroundStyle(Theme.textSecondary)
                                }
                                Spacer()
                                if let tag = row.tag {
                                    Label {
                                        Text(tag.text).foregroundStyle(Theme.textSecondary)
                                    } icon: {
                                        Image(systemName: tag.symbol).foregroundStyle(tag.color)
                                    }
                                    .font(AppFont.caption(13))
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(14)
                            .contentShape(.rect)
                            .contextMenu {
                                if case let .app(id) = row.source, let delete {
                                    Button("Delete Weigh-In", systemImage: "trash", role: .destructive) { delete(id) }
                                }
                            }
                            .accessibilityElement(children: .combine)
                        }
                    }
                    .background(Theme.surface, in: .rect(cornerRadius: Theme.cornerRadius))
                }
            }
        }
    }
}
