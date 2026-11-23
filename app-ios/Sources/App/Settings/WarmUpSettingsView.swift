import Feedback
import SwiftUI

struct WarmUpSettingsView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        Form {
            ThemedSection {
                SettingChoice(
                    title: "Warm-Up Automation", systemImage: "puzzlepiece.fill",
                    selection: store.binding(settings, \.workout.warmUp.automation),
                    options: [
                        SettingOption(value: .none, title: "None"),
                        SettingOption(
                            value: .smart, title: "Smart Warm-Up", detail: "Warm-ups will be automatically added to exercises in your workout depending on how fresh your muscles are and how heavy the weight is"),
                        SettingOption(value: .scheme, title: "Scheme Warm-Up"),
                    ]
                )
                SettingLink(
                    title: "Warm-Up Scheme",
                    systemImage: "list.bullet.indent"
                ) {
                    WarmUpSchemeView()
                }
                SettingToggle(
                    title: "Hide Completed Sets",
                    systemImage: "circle.lefthalf.filled",
                    info: "Completed warm-up sets will be hidden behind the Warm Up menu in your workout", isOn: store.binding(settings, \.workout.warmUp.hideCompletedSets)
                )
                SettingToggle(
                    title: "Simplify Warm-Up Plates",
                    systemImage: "arrow.down.circle",
                    info: "Adjust warm-up weights to the nearest load that doesn't require trivially small plates", isOn: store.binding(settings, \.workout.warmUp.simplifyPlates)
                )
            }
        }
        .themedList()
        .detailTitle("Warm-Up")
        .feedback(self)
    }
}

private struct WarmUpSchemeView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings
    @State private var editing: RestCategory?

    var body: some View {
        Form {
            ThemedSection {
                ForEach(RestCategory.allCases) { category in
                    Button { editing = category } label: {
                        RowLabel(title: category.displayName, detail: summary(steps(category)))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Edit \(category.displayName) scheme")
                }
            }
            ThemedSection {
                ResetRowButton("Reset Scheme") { store.updateSettings { $0.workout.warmUp.schemes = WarmUpSettings().schemes } }
            }
        }
        .themedList()
        .detailTitle("Warm-Up Scheme")
        .sheet(item: $editing) { category in
            WarmUpSchemeEditor(category: category, steps: steps(category))
        }
        .feedback(self)
    }

    private func steps(_ category: RestCategory) -> [WarmUpStep] {
        settings.workout.warmUp.scheme(for: category)
    }

    private func summary(_ steps: [WarmUpStep]) -> String {
        steps.isEmpty ? "None" : steps.map { "\($0.percent)% · \($0.reps) reps" }.joined(separator: "\n")
    }
}

private struct WarmUpSchemeEditor: View {
    let category: RestCategory
    @State var steps: [WarmUpStep]
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(steps.indices, id: \.self) { index in
                    HStack(spacing: 12) {
                        Text("W")
                            .font(AppFont.badge)
                            .frame(width: 30, height: 30)
                            .background(Theme.surfaceRaised, in: .circle)
                        Spacer()
                        TextField("Percent", value: $steps[index].percent, format: .percent)
                            .accessibilityLabel("Warm-up set \(index + 1) percent")
                            .frame(width: 64)
                        TextField("Reps", value: $steps[index].reps, format: .number)
                            .accessibilityLabel("Warm-up set \(index + 1) reps")
                            .frame(width: 48)
                        Text("reps").font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                    }
                    .font(AppFont.number(17))
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .listRowBackground(Theme.background)
                }
                .onDelete { steps.remove(atOffsets: $0) }
                Button("Add Set") {
                    let last = steps.last ?? WarmUpStep(percent: 30, reps: 5)
                    steps.append(WarmUpStep(percent: min(last.percent + 10, 100), reps: last.reps))
                }
                .font(AppFont.rowTitle)
                .underline()
                .listRowBackground(Theme.background)
            }
            .listStyle(.plain)
            .themedList()
            .detailTitle(category.displayName)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        Button("Save to All Categories") { save(to: RestCategory.allCases) }
                    } label: {
                        Text("Save")
                    } primaryAction: {
                        save(to: [category])
                    }
                    .accessibilityLabel("Save")
                }
            }
        }
        .presentationDetents([.large])
        .feedback(self)
    }

    private func save(to categories: [RestCategory]) {
        let cleaned = steps.map { WarmUpStep(percent: min(max($0.percent, 1), 100), reps: max($0.reps, 1)) }
        store.updateSettings { settings in
            for category in categories { settings.workout.warmUp.schemes[category] = cleaned }
        }
        dismiss()
    }
}
