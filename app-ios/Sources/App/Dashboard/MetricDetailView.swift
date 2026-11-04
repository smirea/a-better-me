import Feedback
import Charts
import SwiftUI

struct MetricDetailView: View {
    let route: DashboardRoute
    let initialTab: String?

    @Environment(ExerciseCatalog.self) private var catalog
    @Observe(AppSettings.current) private var settings
    private var values = DashboardValues()
    @State private var tabID: String?
    @State private var range = ChartRange.oneWeek
    @State private var averaging = Averaging.daily
    @State private var fitOverrides: [MetricTab.ID: Bool] = [:]
    @State private var loggingWeight = false
    @State private var loggingMetrics = false
    @State private var editingStepGoal = false
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
                if detail.tabs.count > 1 { tabs(detail.tabs, selected: tab) }
                // Steps leads with the chart and labels its bars, so it drops the summary, the legend, and the list.
                if let steps = plot.steps {
                    VStack(spacing: 10) {
                        chart(tab, plot, footer: detail.footer)
                            .frame(height: 460)
                            .feedback("\(tab.title) Chart", data: (range: plot.rangeLabel, averaging: averaging, points: plot.drawn, steps: steps))
                        StepsRangeSummary(steps: steps, unit: settings.nutrition.distanceUnit)
                    }
                    .padding(.horizontal, Theme.margin)
                } else {
                    summary(tab, plot)
                        .feedback("Summary", data: (stats: plot.stats, range: plot.rangeLabel))
                        .padding(.horizontal, Theme.margin)
                    chart(tab, plot, footer: detail.footer)
                        .frame(height: 320)
                        .feedback("\(tab.title) Chart", data: (range: plot.rangeLabel, averaging: averaging, points: plot.drawn))
                        .padding(.horizontal, Theme.margin)
                }
                controls.padding(.horizontal, Theme.margin)
                if case .steps = detail.footer {} else { legend(tab).padding(.horizontal, Theme.margin) }
                footer(detail.footer, plot, tab: tab).padding(.horizontal, Theme.margin)
            }
            .padding(.bottom, 30)
        }
        .background(Theme.background)
        .detailTitle(detail.title)
        .toolbar {
            if route == .scaleWeight || route == .weightTrend {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Log Weight", systemImage: "plus") { loggingWeight = true }
                }
            }
            if case let .nutrient(id) = route, !NutrientID.macros.contains(id) {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink { NutrientGoalsView(nutrient: id) } label: {
                        Image(systemName: "target")
                    }
                    .accessibilityLabel("Nutrient Goals")
                }
            }
            if route == .steps {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Step Goal", systemImage: "target") { editingStepGoal = true }
                }
            }
            if case .bodyMetric = route {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Log Measurements", systemImage: "plus") { loggingMetrics = true }
                }
            }
        }
        .sheet(isPresented: $loggingWeight) { BodyWeightLogSheet() }
        .sheet(isPresented: $loggingMetrics) { BodyMetricsLogSheet() }
        .sheet(isPresented: $editingStepGoal) {
            if case let .steps(goal, _, _) = values.detail(route).footer { StepGoalSheet(goal: goal.goal) }
        }
        .sheet(item: $shownExercise) { ExerciseDetailSheet(exerciseID: $0.id) }
        .feedback(self)
    }

    private func history(_ plot: MetricPlot, tab: MetricTab, title: String = "History") -> some View {
        TruncatedList(title, items: plot.months.flatMap(\.rows)) { row in
            MonthRowView(row: row)
        } destination: {
            MetricHistoryView(route: route, tab: tab.id, range: range, averaging: averaging, title: title == "History" ? "\(tab.title) History" : title)
        }
    }

    private func fitToData(_ tab: MetricTab) -> Bool { fitOverrides[tab.id] ?? (tab.style == .line) }

    /// Two or three tabs fit a segmented picker; an exercise's nine metrics scroll.
    @ViewBuilder
    private func tabs(_ tabs: [MetricTab], selected tab: MetricTab) -> some View {
        if tabs.count <= 3 {
            Picker("Metric", selection: Binding(get: { tab.id }, set: { tabID = $0 })) {
                ForEach(tabs) { Text($0.title).tag($0.id) }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, Theme.margin)
        } else {
            UnderlineTabs(items: tabs.map { ($0.id, $0.title) }, selection: Binding(get: { tab.id }, set: { tabID = $0 }))
        }
    }

    /// The average is over the plotted points, so it follows the averaging. Totals, bests, and change are over the
    /// range's days, which averaging would distort.
    private func summary(_ tab: MetricTab, _ plot: MetricPlot) -> some View {
        let fit = fitToData(tab)
        return HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .top, spacing: 40) {
                    ForEach(plot.stats, id: \.title) { stat in
                        StatView(title: stat.title, value: stat.value.map(tab.unit.format) ?? "--", unit: tab.unit.label)
                    }
                }
                Text(plot.rangeLabel)
                    .font(AppFont.caption(14))
                    .foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            RoundIconButton(
                fit ? "Scale from zero" : "Fit to data",
                systemImage: fit ? "arrow.down.and.line.horizontal.and.arrow.up" : "arrow.up.and.line.horizontal.and.arrow.down"
            ) { fitOverrides[tab.id] = !fit }
        }
    }

    private func chart(_ tab: MetricTab, _ plot: MetricPlot, footer: MetricDetail.Footer) -> some View {
        let points = plot.drawn
        var stepGoal: StepGoal.Summary?
        if case let .steps(goal, _, _) = footer { stepGoal = goal }
        let fit = stepGoal == nil && fitToData(tab)
        let values = (points + plot.overlay).map(\.value) + (tab.goal.map { [$0] } ?? [])
        let high = max(values.max() ?? 0, 1)
        let low = fit ? values.min() ?? 0 : 0
        let pad = fit ? max((high - low) * 0.1, 0.5) : stepGoal == nil ? high * 0.1 : high / (1 - StepBarLabels.headroom) - high
        return Chart {
            if let line = tab.overlay {
                ForEach(plot.overlay, id: \.date) { point in
                    LineMark(x: .value("Date", point.date), y: .value(line.title, point.value), series: .value("Series", line.title))
                        .foregroundStyle(line.color)
                        .lineStyle(StrokeStyle(lineWidth: line.dashed ? 1.5 : 2, dash: line.dashed ? [2, 3] : []))
                }
            }
            if let goal = tab.goal {
                RuleMark(y: .value("Goal", goal))
                    .foregroundStyle(Theme.goal)
                    .lineStyle(StrokeStyle(lineWidth: 1.5, dash: stepGoal == nil ? [4, 4] : []))
            }
            ForEach(points, id: \.date) { point in
                switch tab.style {
                case .bar:
                    if let stepGoal {
                        BarMark(x: .value("Date", point.date, unit: plot.drawnUnit), y: .value(tab.title, point.value), width: .ratio(StepBarLabels.barRatio))
                            .foregroundStyle(StepGoal.tier(point.value, goal: stepGoal.goal).color)
                            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 8, topTrailingRadius: 8, style: .continuous))
                    } else {
                        BarMark(x: .value("Date", point.date, unit: plot.drawnUnit), y: .value(tab.title, point.value))
                            .foregroundStyle(tab.color)
                    }
                case .line:
                    LineMark(x: .value("Date", point.date), y: .value(tab.title, point.value), series: .value("Series", tab.title))
                        .foregroundStyle(tab.color)
                    if points.count < 15 {
                        PointMark(x: .value("Date", point.date), y: .value(tab.title, point.value))
                            .symbol(.circle.strokeBorder(lineWidth: 1.5))
                            .foregroundStyle(tab.color)
                    } else if plot.holding.contains(point.date) {
                        PointMark(x: .value("Date", point.date), y: .value(tab.title, point.value))
                            .symbol(.square.strokeBorder(lineWidth: 1))
                            .symbolSize(40)
                            .foregroundStyle(tab.color)
                    }
                }
            }
        }
        .chartXScale(domain: plot.xDomain)
        .chartYScale(domain: max(low - pad, fit ? -.infinity : 0)...(high + pad))
        .themedYAxis()
        .chartYAxis(stepGoal == nil ? .automatic : .hidden)
        .chartXAxis {
            AxisMarks(values: .automatic(desiredCount: range == .oneWeek ? 7 : 5)) { _ in
                AxisValueLabel(format: range == .oneWeek ? .dateTime.weekday(.abbreviated) : .dateTime.month(.abbreviated).day())
                    .font(stepGoal == nil ? nil : AppFont.medium(range == .oneWeek ? 16 : 13))
                    .foregroundStyle(stepGoal == nil ? Theme.textSecondary : Theme.textPrimary)
            }
        }
        .chartOverlay { proxy in
            if let stepGoal, let steps = plot.steps {
                StepBarLabels(proxy: proxy, points: points, centers: plot.scrubDates, goal: stepGoal.goal, bars: points.map { point in
                    StepBar(
                        steps: point.value,
                        flights: steps.flights[point.date].map(\.wholeText) ?? "",
                        distance: steps.meters[point.date].map { settings.nutrition.distanceUnit.text(meters: $0, separator: "") } ?? ""
                    )
                })
            }
        }
        // Nothing sits above the Steps chart but the title, which a callout above the plot would cover.
        .chartScrubbing(plot.scrubDates, placement: stepGoal == nil ? .above : .beside) { index in callout(tab, plot, index) }
        .accessibilityLabel("\(tab.title) chart")
    }

    private func callout(_ tab: MetricTab, _ plot: MetricPlot, _ index: Int) -> ChartCallout {
        let point = plot.drawn[index]
        let title = switch plot.drawnUnit {
        case .weekOfYear: "Week of \(point.date.formatted(.dateTime.month(.abbreviated).day()))"
        case .month: point.date.formatted(.dateTime.month(.wide).year())
        default: point.date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
        }
        var lines = [ChartCallout.Line(label: tab.overlay == nil ? nil : tab.seriesTitle ?? tab.title, value: "\(tab.unit.format(point.value)) \(tab.unit.label)", color: tab.color)]
        if let line = tab.overlay, let value = plot.overlayValues[point.date] {
            lines.append(ChartCallout.Line(label: line.title, value: "\(tab.unit.format(value)) \(tab.unit.label)", color: line.color))
        }
        if let flights = plot.steps?.flights[point.date] {
            lines.append(ChartCallout.Line(label: nil, value: "\(flights.wholeText) \(flights == 1 ? "flight" : "flights")", color: Theme.textSecondary))
        }
        if let meters = plot.steps?.meters[point.date] {
            lines.append(ChartCallout.Line(label: nil, value: settings.nutrition.distanceUnit.text(meters: meters), color: Theme.textSecondary))
        }
        return ChartCallout(title: title, lines: lines)
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
                .font(AppFont.chip)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
            }
            .buttonStyle(.glass)
            .accessibilityLabel("Chart Averaging")
            .accessibilityValue(averaging.title)
        }
    }

    private func legend(_ tab: MetricTab) -> some View {
        let line = "point.topleft.down.to.point.bottomright.curvepath"
        var items: [ChartLegend.Item] = []
        if let overlay = tab.overlay, !overlay.dashed {
            items.append(ChartLegend.Item(title: overlay.title, symbol: line, color: overlay.color))
        }
        items.append(ChartLegend.Item(title: tab.seriesTitle ?? tab.title, symbol: tab.style == .bar ? "chart.bar.fill" : line, color: tab.color))
        if let overlay = tab.overlay, overlay.dashed {
            items.append(ChartLegend.Item(title: overlay.title, symbol: "line.horizontal.3", color: overlay.color))
        }
        if !tab.holding.isEmpty {
            items.append(ChartLegend.Item(title: "Holding", symbol: "square", color: tab.color))
        }
        if tab.goal != nil {
            items.append(ChartLegend.Item(title: "Goal", symbol: "line.horizontal.3", color: Theme.goal))
        }
        return ChartLegend(items: items)
    }

    @ViewBuilder
    private func footer(_ footer: MetricDetail.Footer, _ plot: MetricPlot, tab: MetricTab) -> some View {
        switch footer {
        case .months:
            history(plot, tab: tab)
        case let .expenditure(summary):
            ExpenditureInsights(summary: summary)
            history(plot, tab: tab)
        case let .weightTrend(summary):
            WeightTrendInsights(summary: summary, unit: plot.unit)
            history(plot, tab: tab)
        case .energyBalance:
            EnergyBalanceInsights(rows: plot.balanceRows, isExpenditure: plot.isExpenditureBalance)
            history(plot, tab: tab)
        case .weighIns:
            history(plot, tab: tab, title: "Weigh-Ins")
        case let .nutrient(summary):
            NutrientTodaySection(summary: summary)
            history(plot, tab: tab)
        case let .macros(days):
            MacroSplitList(days: days)
        case .steps:
            EmptyView()
        case let .topExercises(top):
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    SectionHeader("Top 5 Exercises by Sets")
                    Text("Last 30 Days").font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
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
                .feedback("Top Exercises", data: top)
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
    var overlay: [DatedValue]
    var overlayValues: [Date: Double]
    /// Where scrubbing draws the rule for each drawn point: a bar's middle is that of its whole day, week, or month,
    /// where Swift Charts draws it even when the range cuts it.
    var scrubDates: [Date]
    /// The range, widened for bars to the whole bins they are drawn over, so a month cut by the range's end stays in
    /// the plot instead of covering the axis.
    var xDomain: ClosedRange<Date>
    var holding: Set<Date>
    /// The tab's own stats when it has them, else the average and the second stat.
    var stats: [MetricTab.Stat]
    /// Every entry, newest first, whatever the range.
    var months: [MonthSection]
    var unit: WeightUnit
    /// Energy Balance's 3- to 90-day mean differences.
    var balanceRows: [(days: Int, mean: Double?)] = []
    var isExpenditureBalance = false
    var steps: StepsPlot?

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
        self.unit = unit
        overlay = tab.overlay.map { drawing.bucket($0.points.inside(interval), calendar: calendar).map { DatedValue(date: max($0.date, interval.start), value: $0.value) } } ?? []
        overlayValues = Dictionary(overlay.map { ($0.date, $0.value) }, uniquingKeysWith: { first, _ in first })
        let bins = drawn.map { calendar.dateInterval(of: drawing.component, for: $0.date)! }
        scrubDates = tab.style == .line ? drawn.map(\.date) : bins.map { $0.start.addingTimeInterval($0.duration / 2) }
        xDomain = tab.style == .bar
            ? min(bins.first?.start ?? interval.start, interval.start)...max(bins.last?.end ?? interval.end, interval.end)
            : interval.start...interval.end
        holding = drawing == .daily ? tab.holding : []
        average = (drawing == averaging ? drawn : averaging.bucket(daily, calendar: calendar)).average
        second = tab.summary.second(of: daily.map(\.value))
        stats = tab.stats?(interval) ?? [
            MetricTab.Stat(title: tab.averageTitle, value: average),
            MetricTab.Stat(title: tab.summary.title(tab.title), value: second),
        ]
        func pointRows(tag: (DatedValue) -> MonthRow.Tag? = { _ in nil }) -> [MonthRow] {
            tab.points.reversed().map { point in
                MonthRow(date: point.date, text: "\(tab.unit.format(point.value)) \(tab.unit.label)", subtitle: point.date.formatted(.dateTime.weekday().month().day()), tag: tag(point))
            }
        }
        let rows: [MonthRow] = switch footer {
        case .months, .weightTrend, .nutrient, .macros:
            pointRows()
        case .steps, .topExercises: []
        case .expenditure:
            pointRows { tab.holding.contains($0.date) ? MonthRow.Tag(text: "Holding", symbol: "square", color: tab.color) : nil }
        case .energyBalance:
            Self.balanceRows(tab, now: now, calendar: calendar)
        case let .weighIns(weighIns):
            weighIns.map { weighIn in
                let date = weighIn.date.formatted(.dateTime.weekday().month().day().hour().minute())
                return switch weighIn.source {
                case let .app(id): MonthRow(date: weighIn.date, text: "\(unit.label(kg: weighIn.kg))", subtitle: date, deletableID: id)
                case .health: MonthRow(date: weighIn.date, text: "\(unit.label(kg: weighIn.kg))", subtitle: "\(date) · Health")
                }
            }
        }
        if case let .steps(summary, flights, meters) = footer {
            func perBar(_ days: [DatedValue]) -> [Date: Double] {
                Dictionary(drawing.bucket(days.inside(interval), calendar: calendar).map { (max($0.date, interval.start), $0.value) }, uniquingKeysWith: { first, _ in first })
            }
            let total = daily.map(\.value).reduce(0, +)
            // Days before the first recorded one are no history rather than misses, as the All range already starts there.
            let first = max(interval.start, tab.points.first.map { calendar.startOfDay(for: $0.date) } ?? interval.start)
            let days = max(calendar.dateComponents([.day], from: first, to: interval.end).day!, 1)
            steps = StepsPlot(
                flights: perBar(flights), meters: perBar(meters), total: total,
                distance: meters.inside(interval).map(\.value).reduce(0, +), goalShare: total / Double(summary.goal * days)
            )
        }
        if case .energyBalance = footer {
            let differences = NutritionMetrics.differences(intake: tab.points, reference: tab.overlay?.points ?? [], calendar: calendar)
            balanceRows = NutritionMetrics.changeSpans.map { (days: $0, mean: NutritionMetrics.trailingMean(differences, days: $0, now: now, calendar: calendar)) }
            isExpenditureBalance = tab.balance == .expenditure
        }
        let months = Dictionary(grouping: rows) { calendar.dateInterval(of: .month, for: $0.date)!.start }
        self.months = months.keys.sorted(by: >).map { month in
            MonthSection(id: month, title: month.formatted(.dateTime.month(.wide).year()), rows: months[month]!)
        }
    }

    private static func balanceRows(_ tab: MetricTab, now: Date, calendar: Calendar) -> [MonthRow] {
        let isExpenditure = tab.balance == .expenditure
        return NutritionMetrics.differences(intake: tab.points, reference: tab.overlay?.points ?? [], calendar: calendar).reversed().map { day in
            let tag = BalanceTag(balance: NutritionMetrics.balance(day.value), isExpenditure: isExpenditure)
            return MonthRow(
                date: day.date, text: "\(BalanceTag.signed(day.value)) kcal", subtitle: day.date.formatted(.dateTime.weekday().month().day()),
                tag: MonthRow.Tag(text: tag.title, symbol: tag.symbol, color: tag.color)
            )
        }
    }

    static func rangeLabel(_ interval: DateInterval, calendar: Calendar) -> String {
        let last = calendar.date(byAdding: .day, value: -1, to: interval.end)!
        return (interval.start..<last.addingTimeInterval(1)).formatted(.interval.month(.abbreviated).day().year())
    }
}

/// What Steps adds to its plot: each drawn bar's flights and distance in meters, averaged like the steps, and the
/// range's totals for the bracket under the chart.
struct StepsPlot: Equatable {
    var flights: [Date: Double]
    var meters: [Date: Double]
    /// Over the range's days, which averaging would distort.
    var total: Double
    var distance: Double
    /// The total over the goal times the range's days from the first recorded one, today included.
    var goalShare: Double

    var tier: StepGoal.Tier { StepGoal.tier(goalShare, goal: 1) }
}

struct MonthSection: Identifiable {
    var id: Date
    var title: String
    var rows: [MonthRow]
}

struct MonthRow: Identifiable {
    struct Tag {
        var text: String
        var symbol: String
        var color: Color
    }

    var date: Date
    var text: String
    var subtitle: String
    /// The app weigh-in the row deletes; Health samples and metric days are not deletable here.
    var deletableID: UUID?
    var tag: Tag?

    var id: String { "\(date.timeIntervalSince1970) \(text)" }
}

private struct TopExerciseRow: View {
    let exercise: Exercise?
    let sets: Int

    var body: some View {
        HStack(spacing: 14) {
            if let exercise {
                ExerciseTile(exercise: exercise, size: .small)
            }
            Text(exercise?.name ?? "Unknown exercise").font(AppFont.headline(15)).lineLimit(2)
            Spacer()
            Text("\(sets) \(sets == 1 ? "set" : "sets")").font(AppFont.body(15))
            Image(systemName: "chevron.forward").font(.footnote.weight(.semibold)).foregroundStyle(Theme.textTertiary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .contentShape(.rect)
        .feedback(self)
    }
}

private struct ShownExercise: Identifiable {
    let id: ExerciseID
}

/// Every entry of a metric, newest first and grouped by month, pushed from the detail screen's history.
private struct MetricHistoryView: View {
    let route: DashboardRoute
    let tab: MetricTab.ID
    let range: ChartRange
    let averaging: Averaging
    let title: String
    private var values = DashboardValues()

    init(route: DashboardRoute, tab: MetricTab.ID, range: ChartRange, averaging: Averaging, title: String) {
        self.route = route
        self.tab = tab
        self.range = range
        self.averaging = averaging
        self.title = title
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                ForEach(values.plot(route, tab: tab, range: range, averaging: averaging).months) { month in
                    VStack(alignment: .leading, spacing: 10) {
                        SectionHeader(month.title)
                        VStack(spacing: 0) {
                            ForEach(Array(month.rows.enumerated()), id: \.element.id) { index, row in
                                if index > 0 { Divider().overlay(Theme.separator) }
                                MonthRowView(row: row)
                            }
                        }
                        .background(Theme.surface, in: .rect(cornerRadius: Theme.cornerRadius))
                    }
                }
            }
            .padding(.horizontal, Theme.margin)
            .padding(.bottom, 30)
        }
        .background(Theme.background)
        .detailTitle(title)
        .feedback(self)
    }
}

private struct MonthRowView: View {
    @Environment(LocalStore.self) private var store
    let row: MonthRow

    var body: some View {
        HStack {
            RowLabel(title: row.text, detail: row.subtitle)
            Spacer()
            if let tag = row.tag {
                Label {
                    Text(tag.text).foregroundStyle(Theme.textSecondary)
                } icon: {
                    Image(systemName: tag.symbol).foregroundStyle(tag.color)
                }
                .font(AppFont.rowDetail)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .contentShape(.rect)
        .contextMenu {
            if let id = row.deletableID {
                Button("Delete Weigh-In", systemImage: "trash", role: .destructive) { store.delete(BodyWeight.self, id: id) }
            }
        }
        .rowSwipeActions(trailing: row.deletableID.map { id in [.destructive("Delete Weigh-In") { store.delete(BodyWeight.self, id: id) }] } ?? [])
        .accessibilityElement(children: .combine)
        .feedback(self)
    }
}
