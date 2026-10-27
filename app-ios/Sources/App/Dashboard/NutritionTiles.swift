import SwiftUI

struct NutritionCardView: View {
    let card: NutritionCard
    private var values = DashboardValues()

    init(card: NutritionCard) { self.card = card }

    var body: some View {
        if let id = card.nutrient, let nutrient = NutrientRegistry.nutrient(id) {
            let tile = values.nutrientTile(card)
            NavigationLink(value: DashboardRoute.nutrient(id)) {
                DashboardCard(title: nutrient.name, period: "Today", value: tile.text, unit: tile.unit) {
                    TileBar(value: tile.consumed, range: tile.range, color: Theme.macro(id))
                }
            }
        } else if card.nutrient == nil {
            let macros = values.macrosCard
            NavigationLink(value: DashboardRoute.macros) {
                DashboardCard(title: "Macros", period: "Last 7 Days", value: macros.text, unit: "kcal avg") {
                    MiniStackedBars(days: macros.days, colors: [Theme.protein, Theme.fat, Theme.carbs])
                }
            }
        }
    }
}

struct BodyMetricCardView: View {
    let card: BodyMetricCard
    private var values = DashboardValues()

    init(card: BodyMetricCard) { self.card = card }

    var body: some View {
        if card == .scaleWeight {
            let entries = values.scaleWeightCard
            NavigationLink(value: DashboardRoute.scaleWeight) {
                DashboardCard(title: "Scale Weight", period: "Last 7 Entries", value: entries.text, unit: values.context.unit.rawValue) {
                    MiniLine(values: entries.values, color: Theme.green)
                }
            }
        } else {
            let entries = values.bodyMetricCard(card)
            NavigationLink(value: DashboardRoute.bodyMetric(card)) {
                DashboardCard(title: card.title, period: "Last 7 Entries", value: entries.text, unit: values.bodyMetricUnit(card)) {
                    MiniLine(values: entries.values, color: Theme.green)
                }
            }
        }
    }
}

/// The Food Log's nutrient bar, centered in a card's chart area.
private struct TileBar: View {
    let value: Double
    let range: NutrientRange
    let color: Color

    var body: some View {
        NutrientBar(value: value, range: range, maximum: FoodLog.barMaximum(value: value, range: range) ?? max(value, 1), color: color)
            .frame(maxHeight: .infinity)
    }
}

/// Calories from protein, fat, and carbs stacked per day, carbs at the bottom as MacroFactor draws them.
struct MiniStackedBars: View {
    let days: [[Double]]
    let colors: [Color]

    var body: some View {
        Canvas { context, size in
            guard !days.isEmpty else { return }
            let top = max(days.map { $0.reduce(0, +) }.max() ?? 0, 1)
            let band = size.width / CGFloat(days.count)
            for (index, parts) in days.enumerated() {
                var y = size.height
                for (part, color) in zip(parts, colors).reversed() where part > 0 {
                    let height = size.height * part / top
                    y -= height
                    context.fill(Rectangle().path(in: CGRect(x: band * (CGFloat(index) + 0.15), y: y, width: band * 0.7, height: height)), with: .color(color))
                }
            }
        }
        .accessibilityHidden(true)
    }
}

struct NutrientTodaySection: View {
    let summary: NutrientSummary
    @Observe private var entries: [FoodEntry]
    @State private var showingAbout = false

    init(summary: NutrientSummary) {
        self.summary = summary
        _entries = Observe(FoodEntry.on(summary.today))
    }

    private var contributors: [(name: String, amount: Double)] {
        let amounts = Dictionary(entries.map { ($0.food.name, $0.amounts.amount(of: summary.nutrient) ?? 0) }, uniquingKeysWith: +)
        return amounts.filter { $0.value > 0 }.sorted { $0.value > $1.value }.prefix(3).map { ($0.key, $0.value) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("\(summary.name) Today").font(AppFont.title())
                Spacer()
                Button("About Nutrient Goals", systemImage: "info.circle") { showingAbout = true }
                    .labelStyle(.iconOnly)
                    .foregroundStyle(Theme.textSecondary)
            }
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline) {
                    Text(amountText).font(AppFont.number(17))
                    Spacer()
                    if let target = summary.range.target, target > 0 {
                        Text("\(Int((summary.consumedToday / target * 100).rounded()))%").font(AppFont.body(14)).foregroundStyle(Theme.textSecondary)
                    }
                }
                TileBar(value: summary.consumedToday, range: summary.range, color: Theme.macro(summary.nutrient)).frame(height: 16)
                if summary.range.floor != nil || summary.range.ceiling != nil {
                    HStack {
                        if let floor = summary.range.floor { Text("Floor \(floor.dashboardText) \(summary.unit)") }
                        Spacer()
                        if let ceiling = summary.range.ceiling { Text("Ceiling \(ceiling.dashboardText) \(summary.unit)") }
                    }
                    .font(AppFont.caption(12))
                    .foregroundStyle(Theme.textSecondary)
                }
                if !contributors.isEmpty {
                    Divider().overlay(Theme.separator)
                    Text("Top 3 Contributors").font(AppFont.headline(15))
                    ForEach(contributors, id: \.name) { item in
                        HStack {
                            Text(item.name).font(AppFont.body(15)).lineLimit(1)
                            Spacer()
                            Text("\(item.amount.dashboardText) \(summary.unit)").font(AppFont.body(15)).foregroundStyle(Theme.textSecondary)
                        }
                    }
                }
            }
            .padding(14)
            .background(Theme.surface, in: .rect(cornerRadius: Theme.cornerRadius))
        }
        .sheet(isPresented: $showingAbout) { AboutNutrientGoalsSheet() }
    }

    private var amountText: String {
        let consumed = summary.consumedToday.dashboardText
        guard let target = summary.range.target else { return "\(consumed) \(summary.unit)" }
        return "\(consumed) / \(target.dashboardText) \(summary.unit)"
    }
}

private struct AboutNutrientGoalsSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    LabeledContent("Floor", value: "A practical minimum: the lower threshold intake, below which nearly everyone falls short.")
                    LabeledContent("Target", value: "The recommended intake (RDA or AI), enough for about 98% of people.")
                    LabeledContent("Ceiling", value: "The tolerable upper intake level. Going over regularly may cause harm.")
                } footer: {
                    Text("A goal may have any of the three. Auto goals follow your age and sex; custom goals are set per nutrient from its detail.")
                }
                .listRowBackground(Theme.surface)
            }
            .themedList()
            .navigationTitle("About Nutrient Goals")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", systemImage: "checkmark") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

struct MacroSplitList: View {
    let days: [(date: Date, split: TileMetrics.MacroSplit)]

    var body: some View {
        LazyVStack(alignment: .leading, spacing: 0) {
            ForEach(Array(days.enumerated()), id: \.element.date) { index, day in
                if index > 0 { Divider().overlay(Theme.separator) }
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(day.date.formatted(.dateTime.weekday().month().day())).font(AppFont.body(15))
                        Spacer()
                        Text(day.split.text).font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
                    }
                    GeometryReader { proxy in
                        HStack(spacing: 2) {
                            Theme.protein.frame(width: proxy.size.width * day.split.protein)
                            Theme.fat.frame(width: proxy.size.width * day.split.fat)
                            Theme.carbs
                        }
                        .clipShape(.capsule)
                    }
                    .frame(height: 6)
                }
                .padding(.vertical, 10)
                .padding(.horizontal, 14)
            }
        }
        .background(Theme.surface, in: .rect(cornerRadius: Theme.cornerRadius))
    }
}

struct AllNutritionView: View {
    @Observe(AppSettings.current) private var settings

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 30) {
                DashboardSectionView(title: "Calories & Macros") {
                    NutritionCardView(card: .macros)
                    ForEach(NutritionMetrics.macros, id: \.self) { NutritionCardView(card: NutritionCard(nutrient: $0)) }
                }
                ForEach(NutrientGroup.allCases, id: \.self) { group in
                    let nutrients = NutrientRegistry.all.filter {
                        $0.group == group && !NutritionMetrics.macros.contains($0.id) && !settings.nutrition.hiddenNutrients.contains($0.id)
                    }
                    if !nutrients.isEmpty {
                        DashboardSectionView(title: group.title) {
                            ForEach(nutrients) { NutritionCardView(card: NutritionCard(nutrient: $0.id)) }
                        }
                    }
                }
            }
            .padding(.vertical, 16)
        }
        .background(Theme.background)
        .navigationTitle("Nutrition")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct AllBodyMetricsView: View {
    @Observe(AppSettings.current) private var settings
    @State private var logging = false

    var body: some View {
        let cards = BodyMetricCard.available(visible: settings.nutrition.visibleBodyMetrics)
        let groups = Dictionary(grouping: cards, by: \.group)
        ScrollView {
            VStack(alignment: .leading, spacing: 30) {
                ForEach(["Weight & Body Fat", "Upper Body", "Arms", "Legs", "Ratios"], id: \.self) { title in
                    if let cards = groups[title] {
                        DashboardSectionView(title: title) {
                            ForEach(cards, id: \.self) { BodyMetricCardView(card: $0) }
                        }
                    }
                }
            }
            .padding(.vertical, 16)
        }
        .background(Theme.background)
        .navigationTitle("Body Metrics")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Log Measurements", systemImage: "plus") { logging = true }
            }
        }
        .sheet(isPresented: $logging) { BodyMetricsLogSheet() }
    }
}

extension DashboardValues {
    func bodyMetricUnit(_ card: BodyMetricCard) -> String {
        card.unit(weight: context.unit, height: nutritionSettings.heightUnit)
    }
}
