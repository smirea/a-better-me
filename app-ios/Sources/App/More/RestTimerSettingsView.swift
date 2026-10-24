import SwiftUI

struct RestTimerSettingsView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        Form {
            Section {
                SettingToggle(
                    title: "Use Rest Timers", detail: "Rest timers will count down after each exercise set",
                    systemImage: "stopwatch.fill", isOn: store.binding(settings, \.workout.rest.enabled)
                )
                SettingLink(
                    title: "Notifications", detail: "Configure notification settings for when rest time is over", systemImage: "bell.fill"
                ) {
                    RestNotificationSettingsView()
                }
                SettingLink(
                    title: "Timer Duration", detail: "Configure rest duration for different exercise types", systemImage: "hourglass"
                ) {
                    RestDurationSettingsView()
                }
                SettingToggle(
                    title: "Rest After Last Warm-up Set", detail: "Use rest timers after the last warm-up set",
                    systemImage: "flag.fill", isOn: store.binding(settings, \.workout.rest.afterLastWarmUp)
                )
                SettingToggle(
                    title: "Rest Between Exercises", detail: "Use rest timers when moving between exercises",
                    systemImage: "checkmark.square.fill", isOn: store.binding(settings, \.workout.rest.betweenExercises)
                )
                SettingToggle(
                    title: "Rest Between Left/Right Sets", detail: "Use rest timers in between left and right sets",
                    systemImage: "arrow.triangle.branch", isOn: store.binding(settings, \.workout.rest.betweenSides)
                )
            } header: {
                SectionTitle("Behavior").textCase(nil)
            }
            Section {
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
            } header: {
                VStack(alignment: .leading, spacing: 2) {
                    SectionTitle("Rest Scaling")
                    Text("Optionally reduce rest under specific conditions").font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                }
                .textCase(nil)
            }
        }
        .navigationTitle("Rest Timer")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct RestNotificationSettingsView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        Form {
            Section {
                SettingToggle(
                    title: "Play Sound", detail: "Play sound when rest time is over",
                    systemImage: "music.note", isOn: store.binding(settings, \.workout.rest.playSound)
                )
                SettingToggle(
                    title: "Vibrate", detail: "Vibrate when rest time is over",
                    systemImage: "iphone.radiowaves.left.and.right", isOn: store.binding(settings, \.workout.rest.vibrate)
                )
            } header: {
                SectionTitle("Notifications").textCase(nil)
            }
        }
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct RestDurationSettingsView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        Form {
            Section {
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
            } header: {
                SectionTitle("Default Timers").textCase(nil)
            }
            Section {
                Button("Reset Defaults", role: .destructive) { store.updateSettings { $0.resetRestTimer() } }
                    .font(AppFont.medium(15))
                    .frame(maxWidth: .infinity)
                    .foregroundStyle(Theme.destructive)
            }
        }
        .navigationTitle("Timer Duration")
        .navigationBarTitleDisplayMode(.inline)
    }
}
