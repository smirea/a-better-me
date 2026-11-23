import Feedback
import SwiftUI

/// Settings > Workout. Also the live workout's "Workout settings" sheet root, so it brings no NavigationStack of its own.
struct WorkoutSettingsView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        Form {
            ThemedSection("General") {
                SettingLink(title: "Rest Timer", systemImage: "stopwatch.fill") {
                    RestTimerSettingsView()
                }
                SettingLink(title: "Smart Progression", systemImage: "wand.and.sparkles") {
                    SmartProgressionSettingsView()
                }
                SettingLink(title: "Warm-Up", systemImage: "figure.cooldown") {
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
                    title: "Propagate Changes",
                    systemImage: "arrowshape.turn.up.right",
                    info: "Weight and rep edits will propagate to all sets with same weight and reps", isOn: store.binding(settings, \.workout.propagateChanges)
                )
                SettingToggle(
                    title: "RIR Tracking",
                    systemImage: "heart.text.square",
                    info: "Automatically populate RIR selection in the session log based on program", isOn: store.binding(settings, \.workout.rirTracking)
                )
                SettingToggle(
                    title: "Superset Auto-Scroll",
                    systemImage: "repeat",
                    info: "Scroll automatically between superset exercises after set completion", isOn: store.binding(settings, \.workout.supersetAutoScroll)
                )
                SettingToggle(
                    title: "Exercise Auto-Next",
                    systemImage: "chevron.forward.2",
                    info: "Scroll next automatically when an exercise is completed", isOn: store.binding(settings, \.workout.exerciseAutoNext)
                )
                SettingToggle(
                    title: "Include Bar Weight",
                    systemImage: "dumbbell",
                    info: "The plate calculator counts the bar or machine's own weight. Tap the bar in the calculator to change it for one machine", isOn: store.binding(settings, \.workout.plateCalculatorIncludesBase)
                )
            }
            ThemedSection("Display") {
                SettingToggle(
                    title: "Keep Alive",
                    systemImage: "sun.max",
                    info: "Keep your phone alive during active workout sessions", isOn: store.binding(settings, \.workout.display.keepAlive)
                )
                SettingToggle(
                    title: "Workout Timer",
                    systemImage: "clock.fill",
                    info: "Show elapsed time during workout sessions", isOn: store.binding(settings, \.workout.display.workoutTimer)
                )
                SettingChoice(
                    title: "Calendar Scrolling", systemImage: "calendar.day.timeline.left",
                    selection: store.binding(settings, \.workout.display.calendarScrolling),
                    options: [
                        SettingOption(value: .daily, title: "Daily Scroll", detail: "Scrolls freely and settles one day at a time"),
                        SettingOption(value: .weekly, title: "Weekly Swipe"),
                    ]
                )
            }
        }
        .themedList()
        .detailTitle("Workout")
        .feedback(self)
    }
}

private struct SmartProgressionSettingsView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        Form {
            ThemedSection {
                SettingChoice(
                    title: "Initial Log Fill", systemImage: "book.pages",
                    selection: store.binding(settings, \.workout.progression.initialFill),
                    options: [
                        SettingOption(
                            value: .smartProgression, title: "Smart Progression values", detail: "When you start a workout, Smart Progression will pre-fill your weight and rep logs based on your workout history and goals"),
                        SettingOption(
                            value: .previousValues, title: "Previous values", detail: "When you start a workout, weight and rep logs will default to Previous workout values"),
                    ]
                )
                SettingToggle(
                    title: "Apply in Session",
                    systemImage: "arrow.triangle.merge",
                    info: "Allow Smart Progression to fill in new values for exercise data entry fields mid-workout.", isOn: store.binding(settings, \.workout.progression.applyInSession)
                )
                SettingToggle(
                    title: "Expand Rep Range",
                    systemImage: "arrow.left.and.right",
                    info: "Allow Smart Progression to widen your target rep range when adding or lowering weight alone can't achieve an optimal result.", isOn: store.binding(settings, \.workout.progression.expandRepRange)
                )
                SettingToggle(
                    title: "Weight Match",
                    systemImage: "equal.square",
                    info: "Prefer matching the previous set's weight when possible.", isOn: store.binding(settings, \.workout.progression.weightMatch)
                )
            }
        }
        .themedList()
        .detailTitle("Smart Progression")
        .feedback(self)
    }
}
