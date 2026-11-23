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
                    systemImage: "arrowshape.turn.up.right", isOn: store.binding(settings, \.workout.propagateChanges)
                )
                SettingToggle(
                    title: "RIR Tracking",
                    systemImage: "heart.text.square", isOn: store.binding(settings, \.workout.rirTracking)
                )
                SettingToggle(
                    title: "Superset Auto-Scroll",
                    systemImage: "repeat", isOn: store.binding(settings, \.workout.supersetAutoScroll)
                )
                SettingToggle(
                    title: "Exercise Auto-Next",
                    systemImage: "chevron.forward.2", isOn: store.binding(settings, \.workout.exerciseAutoNext)
                )
                SettingToggle(
                    title: "Include Bar Weight",
                    systemImage: "dumbbell", isOn: store.binding(settings, \.workout.plateCalculatorIncludesBase)
                )
            }
            ThemedSection("Display") {
                SettingToggle(
                    title: "Keep Alive",
                    systemImage: "sun.max", isOn: store.binding(settings, \.workout.display.keepAlive)
                )
                SettingToggle(
                    title: "Workout Timer",
                    systemImage: "clock.fill", isOn: store.binding(settings, \.workout.display.workoutTimer)
                )
                SettingChoice(
                    title: "Calendar Scrolling", systemImage: "calendar.day.timeline.left",
                    selection: store.binding(settings, \.workout.display.calendarScrolling),
                    options: [
                        SettingOption(value: .daily, title: "Daily Scroll"),
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
                            value: .smartProgression, title: "Smart Progression values"),
                        SettingOption(
                            value: .previousValues, title: "Previous values"),
                    ]
                )
                SettingToggle(
                    title: "Apply in Session",
                    systemImage: "arrow.triangle.merge", isOn: store.binding(settings, \.workout.progression.applyInSession)
                )
                SettingToggle(
                    title: "Expand Rep Range",
                    systemImage: "arrow.left.and.right", isOn: store.binding(settings, \.workout.progression.expandRepRange)
                )
                SettingToggle(
                    title: "Weight Match",
                    systemImage: "equal.square", isOn: store.binding(settings, \.workout.progression.weightMatch)
                )
            }
        }
        .themedList()
        .detailTitle("Smart Progression")
        .feedback(self)
    }
}
