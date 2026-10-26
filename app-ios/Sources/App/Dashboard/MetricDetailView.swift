import Charts
import SwiftUI

struct MetricDetailView: View {
    let route: DashboardRoute
    let initialTab: String?

    @Environment(LocalStore.self) private var store
    @Environment(ExerciseCatalog.self) private var catalog
    private var values = DashboardValues()
    @State private var tabID: String?
    @State private var range = ChartRange.oneWeek
    @State private var averaging = Averaging.daily
    @State private var fitOverrides: [MetricTab.ID: Bool] = [:]
    @State private var loggingWeight = false
    @State private var shownExercise: ShownExercise?

    init(route: DashboardRoute, initialTab: String? = nil) {
        self.route = route
        self.initialTab = initialTab
    }

    var body: some View {
        let detail = values.detail(route)
        let tab = detail.tab(tabID ?? initialTab)
        let plot = values.plot(route, tab: tab.id, range: range, averaging: averaging)
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if detail.tabs.count > 1 { tabStrip(detail.tabs, selected: tab) }
                summary(tab, plot).padding(.horizontal, 20)
                chart(tab, plot)
                    .frame(height: 320)
                    .padding(.horizontal, 20)
                controls.padding(.horizontal, 20)
                legend(tab).padding(.horizontal, 20)
                footer(detail.footer, plot).padding(.horizontal, 20)
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

    private func fitToData(_ tab: MetricTab) -> Bool { fitOverrides[tab.id] ?? (tab.style == .line) }

    private func tabStrip(_ tabs: [MetricTab], selected tab: MetricTab) -> some View {
        ScrollView(.horizontal) {
            HStack(spacing: 0) {
                ForEach(tabs) { item in
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
                        .frame(minWidth: tabs.count == 2 ? 180 : nil)
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
    private func summary(_ tab: MetricTab, _ plot: MetricPlot) -> some View {
        let fit = fitToData(tab)
        return HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .top, spacing: 40) {
                    stat(tab.averageTitle, plot.average, tab: tab)
                    stat(tab.summary.title(tab.title), plot.second, tab: tab)
                }
                Text(plot.rangeLabel)
                    .font(AppFont.caption(14))
                    .foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            Button { fitOverrides[tab.id] = !fit } label: {
                Image(systemName: fit ? "arrow.down.and.line.horizontal.and.arrow.up" : "arrow.up.and.line.horizontal.and.arrow.down")
            }
            .buttonStyle(.glass)
            .buttonBorderShape(.circle)
            .accessibilityLabel(fit ? "Scale from zero" : "Fit to data")
        }
    }

    private func stat(_ title: String, _ value: Double?, tab: MetricTab) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(value.map(tab.format) ?? "--").font(AppFont.number(22))
                Text(tab.unit).font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func chart(_ tab: MetricTab, _ plot: MetricPlot) -> some View {
        let points = plot.drawn
        let fit = fitToData(tab)
        let values = points.map(\.value)
        let high = max(values.max() ?? 0, 1)
        let low = fit ? values.min() ?? 0 : 0
        let pad = fit ? max((high - low) * 0.1, 0.5) : high * 0.1
        return Chart(points, id: \.date) { point in
            switch tab.style {
            case .bar:
                BarMark(x: .value("Date", point.date, unit: plot.drawnUnit), y: .value(tab.title, point.value))
                    .foregroundStyle(tab.color)
            case .line:
                LineMark(x: .value("Date", point.date), y: .value(tab.title, point.value))
                    .foregroundStyle(tab.color)
                if points.count < 15 {
                    PointMark(x: .value("Date", point.date), y: .value(tab.title, point.value))
                        .symbol(.circle.strokeBorder(lineWidth: 1.5))
                        .foregroundStyle(tab.color)
                }
            }
        }
        .chartXScale(domain: plot.interval.start...plot.interval.end)
        .chartYScale(domain: max(low - pad, fit ? -.infinity : 0)...(high + pad))
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

    private func legend(_ tab: MetricTab) -> some View {
        Label {
            Text(tab.title)
        } icon: {
            Image(systemName: tab.style == .bar ? "chart.bar.fill" : "point.topleft.down.to.point.bottomright.curvepath")
                .foregroundStyle(tab.color)
        }
        .font(AppFont.medium(14))
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Theme.surface, in: .rect(cornerRadius: Theme.smallCornerRadius))
    }

    @ViewBuilder
    private func footer(_ footer: MetricDetail.Footer, _ plot: MetricPlot) -> some View {
        switch footer {
        case .months:
            MonthList(months: plot.months)
        case .weighIns:
            MonthList(months: plot.months) { store.delete(BodyWeight.self, id: $0) }
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
                            TopExerciseRow(exercise: catalog.exercise(entry.exerciseID), sets: entry.sets)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .background(Theme.surface, in: .rect(cornerRadius: Theme.cornerRadius))
            }
        }
    }
}

/// What the detail screen shows for one tab, range, and averaging, with every row's text formatted up front.
struct MetricPlot {
    var interval: DateInterval
    var rangeLabel: String
    /// Coarser than the chosen averaging on long ranges; see `Averaging.drawn(over:)`.
    var drawn: [DatedValue]
    var drawnUnit: Calendar.Component
    var average: Double?
    var second: Double?
    /// Every entry, newest first, whatever the range.
    var months: [MonthSection]

    init(tab: MetricTab, footer: MetricDetail.Footer, range: ChartRange, averaging: Averaging, now: Date, calendar: Calendar, unit: WeightUnit) {
        let interval = range.interval(endingAt: now, earliest: tab.points.first?.date, calendar: calendar)
        let daily = tab.points.inside(interval)
        let drawing = averaging.drawn(over: interval)
        // A week or month that began before the range is drawn at the range's start, inside the chart.
        let drawn = drawing.bucket(daily, calendar: calendar).map { DatedValue(date: max($0.date, interval.start), value: $0.value) }
        self.interval = interval
        rangeLabel = Self.rangeLabel(interval, calendar: calendar)
        self.drawn = drawn
        drawnUnit = drawing.component
        average = (drawing == averaging ? drawn : averaging.bucket(daily, calendar: calendar)).average
        second = tab.summary.second(of: daily.map(\.value))
        let rows: [MonthRow] = switch footer {
        case .months:
            tab.points.reversed().map { point in
                MonthRow(date: point.date, text: "\(tab.format(point.value)) \(tab.unit)", subtitle: point.date.formatted(.dateTime.weekday().month().day()))
            }
        case let .weighIns(weighIns):
            weighIns.map { weighIn in
                let date = weighIn.date.formatted(.dateTime.weekday().month().day().hour().minute())
                return switch weighIn.source {
                case let .app(id): MonthRow(date: weighIn.date, text: "\(unit.format(kg: weighIn.kg)) \(unit.rawValue)", subtitle: date, deletableID: id)
                case .health: MonthRow(date: weighIn.date, text: "\(unit.format(kg: weighIn.kg)) \(unit.rawValue)", subtitle: "\(date) · Health")
                }
            }
        case .topExercises: []
        }
        let months = Dictionary(grouping: rows) { calendar.dateInterval(of: .month, for: $0.date)!.start }
        self.months = months.keys.sorted(by: >).map { month in
            MonthSection(id: month, title: month.formatted(.dateTime.month(.wide).year()), rows: months[month]!)
        }
    }

    static func rangeLabel(_ interval: DateInterval, calendar: Calendar) -> String {
        let last = calendar.date(byAdding: .day, value: -1, to: interval.end)!
        return (interval.start..<last.addingTimeInterval(1)).formatted(.interval.month(.abbreviated).day().year())
    }
}

struct MonthSection: Identifiable {
    var id: Date
    var title: String
    var rows: [MonthRow]
}

struct MonthRow: Identifiable {
    var date: Date
    var text: String
    var subtitle: String
    /// The app weigh-in the row deletes; Health samples and metric days are not deletable here.
    var deletableID: UUID?

    var id: String { "\(date.timeIntervalSince1970) \(text)" }
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

/// Lazy by month, so a long range builds only the months scrolled into view.
private struct MonthList: View {
    let months: [MonthSection]
    var delete: ((UUID) -> Void)?

    var body: some View {
        LazyVStack(alignment: .leading, spacing: 20) {
            ForEach(months) { month in
                VStack(alignment: .leading, spacing: 10) {
                    Text(month.title).font(AppFont.title())
                    VStack(spacing: 0) {
                        ForEach(Array(month.rows.enumerated()), id: \.element.id) { index, row in
                            if index > 0 { Divider().overlay(Theme.separator) }
                            VStack(alignment: .leading, spacing: 2) {
                                Text(row.text).font(AppFont.headline(15))
                                Text(row.subtitle)
                                    .font(AppFont.caption(13))
                                    .foregroundStyle(Theme.textSecondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(14)
                            .contentShape(.rect)
                            .contextMenu {
                                if let id = row.deletableID, let delete {
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
