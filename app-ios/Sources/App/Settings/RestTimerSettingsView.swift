import Feedback
import SwiftUI

struct RestTimerSettingsView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        Form {
            ThemedSection("Behavior") {
                SettingToggle(
                    title: "Use Rest Timers",
                    systemImage: "stopwatch.fill",
                    info: "Rest timers will count down after each exercise set", isOn: store.binding(settings, \.workout.rest.enabled)
                )
                SettingLink(
                    title: "Notifications", systemImage: "bell.fill"
                ) {
                    RestNotificationSettingsView()
                }
                SettingLink(
                    title: "Timer Duration", systemImage: "hourglass"
                ) {
                    RestDurationSettingsView()
                }
                SettingToggle(
                    title: "Rest After Last Warm-up Set",
                    systemImage: "flag.fill",
                    info: "Use rest timers after the last warm-up set", isOn: store.binding(settings, \.workout.rest.afterLastWarmUp)
                )
                SettingToggle(
                    title: "Rest Between Exercises",
                    systemImage: "checkmark.square.fill",
                    info: "Use rest timers when moving between exercises", isOn: store.binding(settings, \.workout.rest.betweenExercises)
                )
                SettingToggle(
                    title: "Rest Between Left/Right Sets",
                    systemImage: "arrow.triangle.branch",
                    info: "Use rest timers in between left and right sets", isOn: store.binding(settings, \.workout.rest.betweenSides)
                )
            }
            ThemedSection("Rest Scaling", info: "Optionally reduce rest under specific conditions") {
                SettingChoice(
                    title: "Rest After Last Warm-up Set",
                    selection: store.binding(settings, \.workout.rest.scaling.afterLastWarmUp), options: .percents()
                )
                SettingChoice(
                    title: "Rest Between Exercises",
                    selection: store.binding(settings, \.workout.rest.scaling.betweenExercises), options: .percents()
                )
                SettingChoice(
                    title: "Rest Between Left/Right Sets",
                    selection: store.binding(settings, \.workout.rest.scaling.betweenSides), options: .percents()
                )
            }
        }
        .themedList()
        .detailTitle("Rest Timer")
        .feedback(self)
    }
}

private struct RestNotificationSettingsView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        Form {
            ThemedSection {
                SettingToggle(
                    title: "Play Sound",
                    systemImage: "music.note",
                    info: "Play sound when rest time is over", isOn: store.binding(settings, \.workout.rest.playSound)
                )
                SettingToggle(
                    title: "Vibrate",
                    systemImage: "iphone.radiowaves.left.and.right",
                    info: "Vibrate when rest time is over", isOn: store.binding(settings, \.workout.rest.vibrate)
                )
            }
        }
        .themedList()
        .detailTitle("Notifications")
        .feedback(self)
    }
}

private struct RestDurationSettingsView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        Form {
            ThemedSection {
                ForEach(RestCategory.allCases) { category in
                    SettingChoice(
                        title: category.displayName,
                        selection: Binding(
                            get: { settings.restSeconds(category) },
                            set: { seconds in store.updateSettings { $0.setRestSeconds(seconds, for: category) } }
                        ),
                        options: .restDurations()
                    )
                }
            }
            ThemedSection {
                ResetRowButton("Reset Defaults") { store.updateSettings { $0.resetRestTimer() } }
            }
        }
        .themedList()
        .detailTitle("Timer Duration")
        .feedback(self)
    }
}
