import SwiftUI

/// More > Workout. Also the live workout's "Workout settings" sheet root, so it brings no NavigationStack of its own.
struct WorkoutSettingsView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        Form {
            Section {
                SettingLink(title: "Rest Timer", detail: "Configure rest timer settings", systemImage: "stopwatch.fill") {
                    RestTimerSettingsView()
                }
                SettingLink(title: "Smart Progression", detail: "Configure smart progression settings", systemImage: "wand.and.sparkles") {
                    SmartProgressionSettingsView()
                }
                SettingLink(title: "Warm-Up", detail: "Configure warm-up settings", systemImage: "figure.cooldown") {
                    WarmUpSettingsView()
                }
                SettingChoice(
                    title: "Previous Reference", systemImage: "clock.arrow.circlepath",
                    selection: store.binding(settings, \.workout.previousReference),
                    options: [
                        SettingOption(value: .anyWorkout, title: "Any workout"),
                        SettingOption(value: .withinProgram, title: "Workouts within program only"),
                    ]
                )
                SettingToggle(
                    title: "Propagate Changes", detail: "Weight and rep edits will propagate to all sets with same weight and reps",
                    systemImage: "arrowshape.turn.up.right", isOn: store.binding(settings, \.workout.propagateChanges)
                )
                SettingToggle(
                    title: "RIR Tracking", detail: "Automatically populate RIR selection in the session log based on program",
                    systemImage: "heart.text.square", isOn: store.binding(settings, \.workout.rirTracking)
                )
                SettingToggle(
                    title: "Superset Auto-Scroll", detail: "Scroll automatically between superset exercises after set completion",
                    systemImage: "repeat", isOn: store.binding(settings, \.workout.supersetAutoScroll)
                )
                SettingToggle(
                    title: "Exercise Auto-Next", detail: "Scroll next automatically when an exercise is completed",
                    systemImage: "chevron.forward.2", isOn: store.binding(settings, \.workout.exerciseAutoNext)
                )
            } header: {
                SectionTitle("General").textCase(nil)
            }
            Section {
                SettingToggle(
                    title: "Keep Alive", detail: "Keep your phone alive during active workout sessions",
                    systemImage: "sun.max", isOn: store.binding(settings, \.workout.display.keepAlive)
                )
                SettingToggle(
                    title: "Workout Timer", detail: "Show elapsed time during workout sessions",
                    systemImage: "clock.fill", isOn: store.binding(settings, \.workout.display.workoutTimer)
                )
                SettingToggle(
                    title: "Bodyweight Contribution",
                    detail: "Display scale weight and body weight contribution during workout sessions",
                    systemImage: "scalemass", isOn: store.binding(settings, \.workout.display.bodyweightContribution)
                )
                SettingChoice(
                    title: "Calendar Scrolling", systemImage: "calendar.day.timeline.left",
                    selection: store.binding(settings, \.workout.display.calendarScrolling),
                    options: [
                        SettingOption(value: .daily, title: "Daily Scroll", detail: "Scrolls freely and settles one day at a time"),
                        SettingOption(value: .weekly, title: "Weekly Swipe"),
                    ]
                )
            } header: {
                SectionTitle("Display").textCase(nil)
            }
        }
        .themedList()
        .navigationTitle("Workout")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct SmartProgressionSettingsView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        Form {
            Section {
                SettingChoice(
                    title: "Initial log fill", systemImage: "book.pages",
                    selection: store.binding(settings, \.workout.progression.initialFill),
                    options: [
                        SettingOption(
                            value: .smartProgression, title: "Smart Progression values",
                            detail: "When you start a workout, Smart Progression will pre-fill your weight and rep logs based on your workout history and goals"
                        ),
                        SettingOption(
                            value: .previousValues, title: "Previous values",
                            detail: "When you start a workout, weight and rep logs will default to Previous workout values"
                        ),
                    ]
                )
                SettingToggle(
                    title: "Apply in session",
                    detail: "Allow Smart Progression to fill in new values for exercise data entry fields mid-workout.",
                    systemImage: "arrow.triangle.merge", isOn: store.binding(settings, \.workout.progression.applyInSession)
                )
                SettingToggle(
                    title: "Expand Rep Range",
                    detail: "Allow Smart Progression to widen your target rep range when adding or lowering weight alone can't achieve an optimal result.",
                    systemImage: "arrow.left.and.right", isOn: store.binding(settings, \.workout.progression.expandRepRange)
                )
                SettingToggle(
                    title: "Weight Match", detail: "Prefer matching the previous set's weight when possible.",
                    systemImage: "equal.square", isOn: store.binding(settings, \.workout.progression.weightMatch)
                )
            } header: {
                SectionTitle("Behavior").textCase(nil)
            }
        }
        .themedList()
        .navigationTitle("Smart Progression")
        .navigationBarTitleDisplayMode(.inline)
    }
}
