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
    /// Where the chart came to rest after a scroll; a new tab, range, or averaging opens on its newest window instead.
    @State private var scrolled: (key: PlotKey, start: Date)?
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
        let key = PlotKey(tab: tab.id, range: range, averaging: averaging)
        let window = plot.window(at: scrolled.flatMap { $0.key == key ? $0.start : nil } ?? plot.initialStart)
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if detail.tabs.count > 1 { tabs(detail.tabs, selected: tab) }
                // Steps leads with the chart and labels its bars, so it drops the summary, the legend, and the list.
                if let steps = window.steps {
                    VStack(spacing: 10) {
                        chart(tab, plot, window, key: key, footer: detail.footer)
                            .frame(height: 460)
                            .feedback("\(tab.title) Chart", data: (range: window.label, averaging: averaging, points: window.points, steps: steps))
                        StepsRangeSummary(steps: steps, unit: settings.nutrition.distanceUnit)
                    }
                    .padding(.horizontal, Theme.margin)
                } else {
                    summary(tab, window)
                        .feedback("Summary", data: (stats: window.stats, range: window.label))
                        .padding(.horizontal, Theme.margin)
                    chart(tab, plot, window, key: key, footer: detail.footer)
                        .frame(height: 320)
                        .feedback("\(tab.title) Chart", data: (range: window.label, averaging: averaging, points: window.points))
                        .padding(.horizontal, Theme.margin)
                }
                controls.padding(.horizontal, Theme.margin)
                // A single series needs no key: the title already names it.
                if case .steps = detail.footer {} else if legendItems(tab).count > 1 {
                    ChartLegend(items: legendItems(tab)).padding(.horizontal, Theme.margin)
                }
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

    private func history(_ plot: MetricPlot, tab: MetricTab, title: String? = nil) -> some View {
        TruncatedList(title ?? "History", items: plot.months.flatMap(\.rows)) { row in
            MonthRowView(row: row)
        } destination: {
            MetricHistoryView(route: route, tab: tab.id, range: range, averaging: averaging, title: title ?? "\(tab.title) History")
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

    private func summary(_ tab: MetricTab, _ window: MetricWindow) -> some View {
        let fit = fitToData(tab)
        return HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .top, spacing: 40) {
                    ForEach(window.stats, id: \.title) { stat in
                        StatView(title: stat.title, value: stat.value.map(tab.unit.format) ?? "--", unit: tab.unit.label)
                    }
                }
                Text(window.label)
                    .font(AppFont.caption(14))
                    .foregroundStyle(Theme.textSecondary)
                    .contentTransition(.numericText())
            }
            Spacer()
            RoundIconButton(
                fit ? "Scale from zero" : "Fit to data",
                systemImage: fit ? "arrow.down.and.line.horizontal.and.arrow.up" : "arrow.up.and.line.horizontal.and.arrow.down"
            ) { fitOverrides[tab.id] = !fit }
        }
    }

    /// The marks redraw only when the data changes; the y-axis follows the shown window once a scroll comes to rest.
    private func chart(_ tab: MetricTab, _ plot: MetricPlot, _ window: MetricWindow, key: PlotKey, footer: MetricDetail.Footer) -> some View {
        var stepGoal: Int?
        if case let .steps(goal, _, _) = footer { stepGoal = goal.goal }
        let fit = stepGoal == nil && fitToData(tab)
        let low = fit ? window.low : 0
        let pad = fit ? max((window.high - low) * 0.1, 0.5) : stepGoal == nil ? window.high * 0.1 : window.high / (1 - StepBarLabels.headroom) - window.high
        return ChartScroller(plot: plot, settle: { scrolled = (key, $0) }) {
            MetricChart(tab: tab, plot: plot, range: range, stepGoal: stepGoal, distanceUnit: settings.nutrition.distanceUnit)
                .equatable()
        }
        .chartYScale(domain: max(low - pad, fit ? -.infinity : 0)...(window.high + pad))
        .id(key)
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
                .font(AppFont.chip)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
            }
            .buttonStyle(.glass)
            .accessibilityLabel("Chart Averaging")
            .accessibilityValue(averaging.title)
        }
    }

    private func legendItems(_ tab: MetricTab) -> [ChartLegend.Item] {
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
        return items
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

struct PlotKey: Hashable {
    var tab: MetricTab.ID
    var range: ChartRange
    var averaging: Averaging
}

/// Scrolls a chart through `plot.xDomain`, a range's length at a time, opening on the newest window. It owns the scroll
/// position, so a scroll re-evaluates only this view, and it reports where the scroll came to rest.
private struct ChartScroller<Content: View>: View {
    let plot: MetricPlot
    let settle: (Date) -> Void
    let content: Content

    @State private var position: Date

    init(plot: MetricPlot, settle: @escaping (Date) -> Void, @ViewBuilder content: () -> Content) {
        self.plot = plot
        self.settle = settle
        self.content = content()
        _position = State(initialValue: plot.initialStart)
    }

    var body: some View {
        content
            .chartScrollableAxes(plot.scrolls ? .horizontal : [])
            .chartXVisibleDomain(length: plot.visibleLength)
            .chartScrollTargetBehavior(BinAligned(domain: plot.xDomain, unit: plot.drawnUnit, calendar: plot.calendar))
            .chartScrollPosition(x: $position)
            .task(id: position) {
                try? await Task.sleep(for: .milliseconds(150))
                guard !Task.isCancelled else { return }
                withAnimation(.smooth) { settle(position) }
            }
    }
}

/// A metric's marks over its whole history. Equatable on what it draws, so the detail screen re-rendering for a
/// scroll, a selection, or the y-axis never rebuilds hundreds of marks.
private struct MetricChart: View, @MainActor Equatable {
    let tab: MetricTab
    let plot: MetricPlot
    let range: ChartRange
    let stepGoal: Int?
    let distanceUnit: NutritionSettings.DistanceUnit

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.tab.id == rhs.tab.id && lhs.tab.goal == rhs.tab.goal && lhs.range == rhs.range && lhs.stepGoal == rhs.stepGoal
            && lhs.distanceUnit == rhs.distanceUnit && lhs.plot.drawnUnit == rhs.plot.drawnUnit && lhs.plot.drawn == rhs.plot.drawn
            && lhs.plot.overlay == rhs.plot.overlay && lhs.plot.holding == rhs.plot.holding && lhs.plot.steps == rhs.plot.steps
    }

    var body: some View {
        let points = plot.drawn
        Chart {
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
                            .foregroundStyle(StepGoal.tier(point.value, goal: stepGoal).color)
                            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 8, topTrailingRadius: 8, style: .continuous))
                    } else {
                        BarMark(x: .value("Date", point.date, unit: plot.drawnUnit), y: .value(tab.title, point.value))
                            .foregroundStyle(tab.color)
                    }
                case .line:
                    LineMark(x: .value("Date", point.date), y: .value(tab.title, point.value), series: .value("Series", tab.title))
                        .foregroundStyle(tab.color)
                    if plot.marksPoints {
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
        .themedYAxis()
        .chartYAxis(stepGoal == nil ? .automatic : .hidden)
        .chartXAxis {
            AxisMarks(values: axisValues) { _ in
                AxisValueLabel(format: axisFormat)
                    .font(stepGoal == nil ? nil : AppFont.medium(span == .week ? 16 : 13))
                    .foregroundStyle(stepGoal == nil ? Theme.textSecondary : Theme.textPrimary)
            }
        }
        .chartOverlay { proxy in
            if let stepGoal, let steps = plot.steps {
                StepBarLabels(proxy: proxy, points: points, centers: plot.scrubDates, goal: stepGoal, bars: points.map { point in
                    StepBar(
                        steps: point.value,
                        flights: steps.flights[point.date].map(\.wholeText) ?? "",
                        distance: steps.meters[point.date].map { distanceUnit.text(meters: $0, separator: "") } ?? ""
                    )
                })
            }
        }
        // Nothing sits above the Steps chart but the title, which a callout above the plot would cover.
        .chartScrubbing(plot.scrubDates, placement: stepGoal == nil ? .above : .beside) { index in callout(index) }
    }

    /// The labels the shown window's length fits, whatever range and averaging made it: 1W averaged by month shows a
    /// month.
    private enum AxisSpan: Equatable { case week, month, months, year, all(long: Bool) }

    private var span: AxisSpan {
        let days = plot.visibleLength / 86_400
        if range == .all { return .all(long: days > 400) }
        return days <= 10 ? .week : days <= 45 ? .month : days <= 200 ? .months : .year
    }

    /// Calendar-aligned marks, so the labels stay on the same days while the chart scrolls.
    private var axisValues: AxisMarkValues {
        switch span {
        case .week: .stride(by: .day)
        case .month: .stride(by: .weekOfYear)
        case .months, .year: .stride(by: .month)
        case .all: .automatic(desiredCount: 5)
        }
    }

    private var axisFormat: Date.FormatStyle {
        switch span {
        case .week: .dateTime.weekday(.abbreviated)
        case .month: .dateTime.month(.abbreviated).day()
        case .months: .dateTime.month(.abbreviated)
        case .year: .dateTime.month(.narrow)
        case let .all(long): long ? .dateTime.month(.abbreviated).year(.twoDigits) : .dateTime.month(.abbreviated).day()
        }
    }
    private func callout(_ index: Int) -> ChartCallout {
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
            lines.append(ChartCallout.Line(label: nil, value: distanceUnit.text(meters: meters), color: Theme.textSecondary))
        }
        return ChartCallout(title: title, lines: lines)
    }
}

/// What the detail screen draws for one tab, range, and averaging: every entry, which the chart scrolls through a
/// window of the range's length at a time, with every row's text formatted up front.
struct MetricPlot {
    /// The range's newest days, where the chart opens.
    var latest: DateInterval
    /// Coarser than the chosen averaging on long ranges; see `Averaging.drawn(over:)`.
    var drawn: [DatedValue]
    var drawnUnit: Calendar.Component
    var overlay: [DatedValue]
    var overlayValues: [Date: Double]
    /// Where a tap draws the rule for each drawn point: a bar's middle is that of its whole day, week, or month,
    /// where Swift Charts draws it.
    var scrubDates: [Date]
    /// Every entry's days, from the first entry or the newest window's start when that is earlier, to the end of today,
    /// widened for bars to the whole bins they are drawn over.
    var xDomain: ClosedRange<Date>
    /// How much of `xDomain` the chart shows at once: the range's length (in whole weeks for weekly bars), or all of it for All.
    var visibleLength: TimeInterval
    /// Whether the newest window holds few enough points to mark each one.
    var marksPoints: Bool
    var holding: Set<Date>
    /// Every entry, newest first, whatever the range.
    var months: [MonthSection]
    var unit: WeightUnit
    /// Energy Balance's 3- to 90-day mean differences.
    var balanceRows: [(days: Int, mean: Double?)] = []
    var isExpenditureBalance = false
    var steps: StepsPlot?

    private var daily: [DatedValue]
    private var historyStart: Date
    private var averaging: Averaging
    private var drawing: Averaging
    private(set) var calendar: Calendar
    private var summary: (tab: MetricTab, steps: (goal: Int, meters: [DatedValue])?)

    var scrolls: Bool { visibleLength < xDomain.upperBound.timeIntervalSince(xDomain.lowerBound) - 1 }
    var initialStart: Date { xDomain.upperBound.addingTimeInterval(-visibleLength) }

    init(tab: MetricTab, footer: MetricDetail.Footer, range: ChartRange, averaging: Averaging, now: Date, calendar: Calendar, unit: WeightUnit) {
        let latest = range.interval(endingAt: now, earliest: tab.points.first?.date, calendar: calendar)
        let history = DateInterval(start: min(latest.start, tab.points.first.map { calendar.startOfDay(for: $0.date) } ?? latest.start), end: latest.end)
        let daily = tab.points.inside(history)
        let drawing = averaging.drawn(over: latest)
        let drawn = drawing.bucket(daily, calendar: calendar)
        self.latest = latest
        self.daily = daily
        historyStart = history.start
        self.averaging = averaging
        self.drawing = drawing
        self.calendar = calendar
        self.drawn = drawn
        drawnUnit = drawing.component
        self.unit = unit
        overlay = tab.overlay.map { drawing.bucket($0.points.inside(history), calendar: calendar) } ?? []
        overlayValues = Dictionary(overlay.map { ($0.date, $0.value) }, uniquingKeysWith: { first, _ in first })
        let bins = drawn.map { calendar.dateInterval(of: drawing.component, for: $0.date)! }
        scrubDates = tab.style == .line ? drawn.map(\.date) : bins.map { $0.start.addingTimeInterval($0.duration / 2) }
        let domain = tab.style == .bar
            ? calendar.dateInterval(of: drawing.component, for: history.start)!.start...calendar.dateInterval(of: drawing.component, for: history.end.addingTimeInterval(-1))!.end
            : history.start...history.end
        xDomain = domain
        let domainLength = domain.upperBound.timeIntervalSince(domain.lowerBound)
        // Weekly and monthly bars show whole calendar bins, at least one, so the window opens on a bin's start; the
        // slack keeps a week that gains an hour at a daylight saving change from counting as two.
        let typical: TimeInterval = drawing == .monthly ? 30.44 * 86_400 : 7 * 86_400
        let count = max(Int((latest.duration / typical - 0.05).rounded(.up)), 1)
        let opening = drawing == .daily ? latest.start : calendar.date(byAdding: drawing.component, value: -count, to: domain.upperBound)!
        let length = domain.upperBound.timeIntervalSince(opening)
        visibleLength = range == .all ? domainLength : min(length, domainLength)
        marksPoints = drawn.inside(latest).count < 15
        holding = drawing == .daily ? tab.holding : []
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
        summary = (tab, nil)
        if case let .steps(goal, flights, meters) = footer {
            func perBar(_ days: [DatedValue]) -> [Date: Double] {
                Dictionary(drawing.bucket(days.inside(history), calendar: calendar).map { ($0.date, $0.value) }, uniquingKeysWith: { first, _ in first })
            }
            steps = StepsPlot(flights: perBar(flights), meters: perBar(meters))
            summary.steps = (goal.goal, meters)
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

    /// The days the chart shows when scrolled to `start`, and what the screen says about them. The average is over the
    /// drawn points, so it follows the averaging. Totals, bests, and change are over the days, which averaging would
    /// distort.
    func window(at start: Date) -> MetricWindow {
        // A scroll rests within a point of a bar's edge, which could leave out that bar's day.
        let start = calendar.nearestEdge(of: drawnUnit, to: min(max(start, xDomain.lowerBound), initialStart))
        let interval = DateInterval(start: start, duration: visibleLength)
        let days = daily.inside(interval)
        let tab = summary.tab
        let points = drawn.inside(interval)
        let average = (drawing == averaging ? points : averaging.bucket(days, calendar: calendar)).average
        let stats = tab.stats?(interval) ?? [
            MetricTab.Stat(title: tab.averageTitle, value: average),
            MetricTab.Stat(title: tab.summary.title(tab.title), value: tab.summary.second(of: days.map(\.value))),
        ]
        let values = (points + overlay.inside(interval)).map(\.value) + (tab.goal.map { [$0] } ?? [])
        // A window runs past today when bars widen the domain to a whole week or month.
        let end = min(interval.end, latest.end)
        let labelStart = max(interval.start, historyStart)
        var steps: StepsSummary?
        if let summaryInputs = summary.steps {
            let total = days.map(\.value).reduce(0, +)
            // Days before the first recorded one are no history rather than misses, as the All range already starts there.
            let first = max(interval.start, daily.first.map { calendar.startOfDay(for: $0.date) } ?? interval.start)
            let count = max(calendar.dateComponents([.day], from: first, to: end).day!, 1)
            steps = StepsSummary(
                total: total, distance: summaryInputs.meters.inside(interval).map(\.value).reduce(0, +),
                goalShare: total / Double(summaryInputs.goal * count)
            )
        }
        return MetricWindow(
            interval: interval, label: Self.rangeLabel(DateInterval(start: labelStart, end: max(end, labelStart)), calendar: calendar),
            points: points, stats: stats, low: values.min() ?? 0, high: max(values.max() ?? 0, 1), steps: steps
        )
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
        return (interval.start..<max(last, interval.start).addingTimeInterval(1)).formatted(.interval.month(.abbreviated).day().year())
    }
}

/// The days a scrolled chart shows and the screen's summary of them.
struct MetricWindow: Equatable {
    var interval: DateInterval
    var label: String
    var points: [DatedValue]
    var stats: [MetricTab.Stat]
    /// The extent of the shown values, the overlay's and the goal included, which the y-axis fits.
    var low: Double
    var high: Double
    var steps: StepsSummary?
}

/// Each Steps bar's flights and distance in meters, averaged like the steps.
struct StepsPlot: Equatable {
    var flights: [Date: Double]
    var meters: [Date: Double]
}

/// The shown days' totals for the bracket under the Steps chart.
struct StepsSummary: Equatable {
    var total: Double
    var distance: Double
    /// The total over the goal times the shown days from the first recorded one, today included.
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
            Text(exercise?.name ?? Exercise.unknownName).font(AppFont.headline(15)).lineLimit(2)
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

/// Brings a scroll to rest on a whole bar: a day, week, or month boundary, whichever is nearer. Swift Charts'
/// `valueAligned(matching:)` left the chart wherever the finger let go on iOS 27, while its paging snapped, so this maps
/// the target offset to a date over the scrollable content and back.
private struct BinAligned: ChartScrollTargetBehavior {
    let domain: ClosedRange<Date>
    let unit: Calendar.Component
    let calendar: Calendar

    func updateTarget(_ target: inout ScrollTarget, context: ChartScrollTargetBehaviorContext) {
        let width = context.contentSize.width
        let span = domain.upperBound.timeIntervalSince(domain.lowerBound)
        guard width > 0, span > 0 else { return }
        let date = domain.lowerBound.addingTimeInterval(target.rect.minX / width * span)
        let edge = calendar.nearestEdge(of: unit, to: date)
        target.rect.origin.x = edge.timeIntervalSince(domain.lowerBound) / span * width
    }
}

extension Calendar {
    func nearestEdge(of unit: Calendar.Component, to date: Date) -> Date {
        let bin = dateInterval(of: unit, for: date)!
        return date.timeIntervalSince(bin.start) < bin.duration / 2 ? bin.start : bin.end
    }
}
