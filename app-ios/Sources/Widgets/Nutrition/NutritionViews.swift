import SwiftUI
import WidgetKit

/// A nutrient's day as a ring: the tint's faint track and the share of the goal eaten.
struct NutrientRing<Label: View>: View {
    let progress: NutrientProgress
    var lineWidth: CGFloat = 8
    @ViewBuilder var label: Label

    var body: some View {
        ZStack {
            Circle().stroke(progress.nutrient.tint.color.opacity(0.22), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: progress.fraction)
                .stroke(progress.nutrient.tint.color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .widgetAccentable()
            label.padding(lineWidth)
        }
        .padding(lineWidth / 2)
    }
}

/// A nutrient's day as a thin bar under its name and totals.
struct NutrientBarRow: View {
    let progress: NutrientProgress

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(progress.nutrient.name)
                    .font(AppFont.medium(13))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                Spacer(minLength: 4)
                Text(progress.remainingLabel)
                    .font(AppFont.caption(12))
                    .foregroundStyle(progress.isOver ? Theme.destructive : Theme.textSecondary)
                    .monospacedDigit()
                    .lineLimit(1)
            }
            Gauge(value: progress.fraction) { EmptyView() }
                .gaugeStyle(.accessoryLinearCapacity)
                .tint(progress.nutrient.tint.color)
                .widgetAccentable()
        }
    }
}

/// What a nutrition widget shows when it has no day to draw.
struct NutritionNotice: View {
    let state: NutritionEntry.State

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Image(systemName: "fork.knife").foregroundStyle(Theme.accent)
            Text(message)
                .font(AppFont.caption(13))
                .foregroundStyle(Theme.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var message: String {
        switch state {
        case .stale: "Open A Better Me to refresh today's targets."
        case .empty, .ready: "Open A Better Me to start tracking."
        }
    }
}

extension View {
    func nutritionWidgetChrome() -> some View {
        foregroundStyle(Theme.textPrimary)
            .containerBackground(Theme.background, for: .widget)
            .widgetURL(QuickAction.foodLog.url)
    }
}

/// "P" for Protein, the first letter MacroFactor's compact macro rows use.
extension NutrientProgress {
    var initial: String { String(nutrient.name.prefix(1)) }
}
