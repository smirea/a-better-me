import AppIntents
import SwiftUI
import WidgetKit

struct QuickActionsConfiguration: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Quick Actions"
    static let description = IntentDescription("Choose the quick actions this widget will perform.")

    @Parameter(title: "First Action", default: .search) var first: QuickAction
    @Parameter(title: "Second Action", default: .barcode) var second: QuickAction
    @Parameter(title: "Third Action", default: .quickAdd) var third: QuickAction
    @Parameter(title: "Fourth Action", default: .weight) var fourth: QuickAction

    var actions: [QuickAction] { [first, second, third, fourth] }
}

struct QuickActionsEntry: TimelineEntry {
    let date: Date
    let actions: [QuickAction]
}

struct QuickActionsProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> QuickActionsEntry {
        QuickActionsEntry(date: .now, actions: QuickActionsConfiguration().actions)
    }

    func snapshot(for configuration: QuickActionsConfiguration, in context: Context) async -> QuickActionsEntry {
        QuickActionsEntry(date: .now, actions: configuration.actions)
    }

    func timeline(for configuration: QuickActionsConfiguration, in context: Context) async -> Timeline<QuickActionsEntry> {
        Timeline(entries: [QuickActionsEntry(date: .now, actions: configuration.actions)], policy: .never)
    }
}

/// MacroFactor's Quick Actions: four configurable buttons that open the app on a screen. The Lock Screen's circle
/// holds the first.
struct QuickActionsWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: WidgetKind.quickActions, intent: QuickActionsConfiguration.self, provider: QuickActionsProvider()) { entry in
            QuickActionsView(actions: entry.actions)
                .foregroundStyle(Theme.textPrimary)
                .containerBackground(Theme.background, for: .widget)
        }
        .configurationDisplayName("Quick Actions")
        .description("Choose the quick actions this widget will perform.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular])
    }
}

private struct QuickActionsView: View {
    let actions: [QuickAction]
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: actions[0].systemImage).font(.title2)
            }
            .widgetURL(actions[0].url)
            .accessibilityLabel(actions[0].title)
        case .systemMedium:
            HStack(alignment: .top, spacing: 8) {
                ForEach(Array(actions.enumerated()), id: \.offset) { _, action in
                    ActionButton(action: action, showsTitle: true)
                }
            }
        default:
            Grid(horizontalSpacing: 10, verticalSpacing: 10) {
                GridRow {
                    ActionButton(action: actions[0], showsTitle: false)
                    ActionButton(action: actions[1], showsTitle: false)
                }
                GridRow {
                    ActionButton(action: actions[2], showsTitle: false)
                    ActionButton(action: actions[3], showsTitle: false)
                }
            }
        }
    }
}

private struct ActionButton: View {
    let action: QuickAction
    let showsTitle: Bool

    var body: some View {
        Button(intent: OpenQuickActionIntent(action)) {
            VStack(spacing: 6) {
                Image(systemName: action.systemImage)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(Theme.textPrimary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Theme.surfaceRaised, in: .rect(cornerRadius: Theme.cornerRadius))
                    .widgetAccentable()
                if showsTitle {
                    Text(action.title)
                        .font(AppFont.caption(11))
                        .foregroundStyle(Theme.textSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(action.title)
    }
}

struct QuickActionControlConfiguration: ControlConfigurationIntent {
    static let title: LocalizedStringResource = "Quick Action"

    @Parameter(title: "Action", default: .search) var action: QuickAction
}

/// MacroFactor's Quick Action control for Control Center, the Lock Screen, and the Action button.
struct QuickActionControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        AppIntentControlConfiguration(kind: WidgetKind.quickActionControl, intent: QuickActionControlConfiguration.self) { configuration in
            ControlWidgetButton(action: OpenQuickActionIntent(configuration.action)) {
                Label(configuration.action.title, systemImage: configuration.action.systemImage)
            }
        }
        .displayName("Quick Action")
        .description("Open A Better Me on a screen.")
    }
}
