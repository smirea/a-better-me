import SwiftUI
import WidgetKit

/// MacroFactor's Current & Remaining: calories left today and the macros under them.
struct CurrentAndRemainingWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WidgetKind.currentAndRemaining, provider: CurrentAndRemainingProvider()) { entry in
            CurrentAndRemainingView(entry: entry).nutritionWidgetChrome()
        }
        .configurationDisplayName("Current & Remaining")
        .description("Reference details of your nutrient totals and remaining budget.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

/// MacroFactor's Nutrient Focus: one nutrient, picked in the widget's settings.
struct NutrientFocusWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: WidgetKind.nutrientFocus, intent: NutrientFocusConfiguration.self, provider: NutrientFocusProvider()) { entry in
            NutrientFocusView(entry: entry).nutritionWidgetChrome()
        }
        .configurationDisplayName("Nutrient Focus")
        .description("Track your progress towards your macro or micronutrient targets.")
        .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

/// MacroFactor's Nutrient Collection: up to four nutrients side by side.
struct NutrientCollectionWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: WidgetKind.nutrientCollection, intent: NutrientCollectionConfiguration.self, provider: NutrientCollectionProvider()) { entry in
            NutrientCollectionView(entry: entry).nutritionWidgetChrome()
        }
        .configurationDisplayName("Nutrient Collection")
        .description("Track multiple nutrients at once.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

private struct CurrentAndRemainingView: View {
    let entry: NutritionEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        let all = entry.progress
        if let calories = all.first, case .ready = entry.state {
            let macros = Array(all.dropFirst())
            switch family {
            case .accessoryInline:
                Text(calories.remainingLabel)
            case .accessoryCircular:
                Gauge(value: calories.fraction) {
                    Image(systemName: "flame.fill")
                } currentValueLabel: {
                    Text(NutrientProgress.number(calories.remaining ?? calories.consumed))
                }
                .gaugeStyle(.accessoryCircular)
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 2) {
                    Text(calories.remainingLabel)
                        .font(AppFont.headline(15))
                        .widgetAccentable()
                    Text(macros.map { "\($0.initial) \(NutrientProgress.number($0.remaining ?? $0.consumed))" }.joined(separator: " · "))
                        .font(AppFont.caption(13))
                    Text(calories.goal == nil ? "eaten today" : "left today")
                        .font(AppFont.caption(12))
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            case .systemMedium:
                HStack(spacing: 16) {
                    CaloriesRing(calories: calories, size: 22)
                    VStack(alignment: .leading, spacing: 10) {
                        Text(calories.totalLabel)
                            .font(AppFont.caption(12))
                            .foregroundStyle(Theme.textSecondary)
                            .monospacedDigit()
                        ForEach(macros, id: \.nutrient.id) { NutrientBarRow(progress: $0) }
                    }
                }
            default:
                VStack(spacing: 8) {
                    CaloriesRing(calories: calories, size: 20)
                    HStack(spacing: 0) {
                        ForEach(macros, id: \.nutrient.id) { macro in
                            VStack(spacing: 0) {
                                Text(macro.initial).foregroundStyle(macro.nutrient.tint.color).widgetAccentable()
                                Text(NutrientProgress.number(macro.remaining ?? macro.consumed)).monospacedDigit()
                            }
                            .font(AppFont.medium(12))
                            .frame(maxWidth: .infinity)
                        }
                    }
                }
            }
        } else {
            NutritionNotice(state: entry.state)
        }
    }
}

/// The calorie ring with what is left, or what was eaten when no plan sets a target.
private struct CaloriesRing: View {
    let calories: NutrientProgress
    let size: CGFloat

    var body: some View {
        NutrientRing(progress: calories, lineWidth: 9) {
            VStack(spacing: 0) {
                Text(NutrientProgress.number(calories.remaining ?? calories.consumed))
                    .font(AppFont.number(size))
                    .foregroundStyle(calories.isOver ? Theme.destructive : Theme.textPrimary)
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
                Text(calories.goal == nil ? "kcal eaten" : calories.isOver ? "kcal over" : "kcal left")
                    .font(AppFont.caption(11))
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(1)
            }
        }
    }
}

private struct NutrientFocusView: View {
    let entry: NutritionEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        if let progress = entry.progress.first, case .ready = entry.state {
            switch family {
            case .accessoryInline:
                Text("\(progress.nutrient.name) · \(progress.remainingLabel)")
            case .accessoryCircular:
                Gauge(value: progress.fraction) {
                    Text(progress.initial)
                } currentValueLabel: {
                    Text(NutrientProgress.number(progress.consumed))
                }
                .gaugeStyle(.accessoryCircularCapacity)
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 2) {
                    Text(progress.nutrient.name).font(AppFont.headline(15)).widgetAccentable()
                    Text(progress.totalLabel).font(AppFont.caption(13)).monospacedDigit()
                    Gauge(value: progress.fraction) { EmptyView() }.gaugeStyle(.accessoryLinearCapacity)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            default:
                VStack(alignment: .leading, spacing: 6) {
                    Text(progress.nutrient.name)
                        .font(AppFont.headline(14))
                        .foregroundStyle(progress.nutrient.tint.color)
                        .widgetAccentable()
                    NutrientRing(progress: progress, lineWidth: 9) {
                        VStack(spacing: 0) {
                            Text(NutrientProgress.number(progress.consumed))
                                .font(AppFont.number(20))
                                .minimumScaleFactor(0.5)
                                .lineLimit(1)
                            Text(progress.nutrient.unit)
                                .font(AppFont.caption(11))
                                .foregroundStyle(Theme.textSecondary)
                                .lineLimit(1)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    Text(progress.remainingLabel)
                        .font(AppFont.caption(12))
                        .foregroundStyle(progress.isOver ? Theme.destructive : Theme.textSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .frame(maxWidth: .infinity)
                }
            }
        } else {
            NutritionNotice(state: entry.state)
        }
    }
}

private struct NutrientCollectionView: View {
    let entry: NutritionEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        let all = Array(entry.progress.prefix(4))
        if !all.isEmpty, case .ready = entry.state {
            switch family {
            case .accessoryRectangular:
                HStack(spacing: 6) {
                    ForEach(all, id: \.nutrient.id) { progress in
                        Gauge(value: progress.fraction) {
                            EmptyView()
                        } currentValueLabel: {
                            Text(progress.initial)
                        }
                        .gaugeStyle(.accessoryCircularCapacity)
                    }
                }
            case .systemMedium:
                HStack(alignment: .top, spacing: 10) {
                    ForEach(all, id: \.nutrient.id) { progress in
                        VStack(spacing: 4) {
                            NutrientRing(progress: progress, lineWidth: 7) {
                                Text(NutrientProgress.number(progress.consumed))
                                    .font(AppFont.number(15))
                                    .minimumScaleFactor(0.5)
                                    .lineLimit(1)
                            }
                            Text(progress.nutrient.name).font(AppFont.medium(12)).lineLimit(1)
                            Text(progress.remainingLabel)
                                .font(AppFont.caption(11))
                                .foregroundStyle(progress.isOver ? Theme.destructive : Theme.textSecondary)
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            default:
                Grid(horizontalSpacing: 8, verticalSpacing: 6) {
                    ForEach(0..<2, id: \.self) { row in
                        GridRow {
                            ForEach(all.dropFirst(row * 2).prefix(2), id: \.nutrient.id) { progress in
                                VStack(spacing: 2) {
                                    NutrientRing(progress: progress, lineWidth: 6) {
                                        Text(NutrientProgress.number(progress.consumed))
                                            .font(AppFont.number(12))
                                            .minimumScaleFactor(0.5)
                                            .lineLimit(1)
                                    }
                                    Text(progress.nutrient.name).font(AppFont.caption(11)).lineLimit(1)
                                }
                            }
                        }
                    }
                }
            }
        } else {
            NutritionNotice(state: entry.state)
        }
    }
}
