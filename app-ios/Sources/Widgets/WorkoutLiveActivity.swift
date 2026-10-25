import ActivityKit
import SwiftUI
import WidgetKit

struct WorkoutLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            Text(context.state.name)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.center) { Text(context.state.name) }
            } compactLeading: {
                Image(systemName: "dumbbell.fill")
            } compactTrailing: {
                EmptyView()
            } minimal: {
                Image(systemName: "dumbbell.fill")
            }
        }
    }
}
