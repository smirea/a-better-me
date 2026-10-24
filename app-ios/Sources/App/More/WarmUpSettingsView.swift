import SwiftUI

struct WarmUpSettingsView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings

    var body: some View {
        Form {
            Section {
                SettingChoice(
                    title: "Warm-Up Automation", systemImage: "puzzlepiece.fill",
                    selection: store.binding(settings, \.workout.warmUp.automation),
                    options: [
                        SettingOption(value: .none, title: "None"),
                        SettingOption(
                            value: .smart, title: "Smart Warm-Up",
                            detail: "Warm-ups will be automatically added to exercises in your workout depending on how fresh your muscles are and how heavy the weight is"
                        ),
                        SettingOption(value: .scheme, title: "Scheme Warm-Up"),
                    ]
                )
                SettingLink(
                    title: "Warm-Up Scheme", detail: "Configure the default warm-up scheme used in the workout warm-up calculator",
                    systemImage: "list.bullet.indent"
                ) {
                    WarmUpSchemeView()
                }
                SettingToggle(
                    title: "Hide Completed Sets", detail: "Completed warm-up sets will be hidden behind the Warm Up menu in your workout",
                    systemImage: "circle.lefthalf.filled", isOn: store.binding(settings, \.workout.warmUp.hideCompletedSets)
                )
                SettingToggle(
                    title: "Simplify Warm-Up Plates",
                    detail: "Adjust warm-up weights to the nearest load that doesn't require trivially small plates",
                    systemImage: "arrow.down.circle", isOn: store.binding(settings, \.workout.warmUp.simplifyPlates)
                )
            } header: {
                SectionTitle("Behavior").textCase(nil)
            }
        }
        .navigationTitle("Warm-Up")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct WarmUpSchemeView: View {
    @Environment(LocalStore.self) private var store
    @Observe(AppSettings.current) private var settings
    @State private var editing: RestCategory?

    var body: some View {
        Form {
            Section {
                ForEach(RestCategory.allCases) { category in
                    LabeledContent {
                        Button("Edit") { editing = category }
                            .font(AppFont.medium(14))
                            .buttonStyle(.bordered)
                            .buttonBorderShape(.capsule)
                            .tint(Theme.textPrimary)
                            .accessibilityLabel("Edit \(category.displayName) scheme")
                    } label: {
                        SettingLabel(title: category.displayName, detail: summary(steps(category)))
                    }
                }
            } header: {
                SectionTitle("Scheme").textCase(nil)
            }
            Section {
                Button("Reset Scheme", role: .destructive) { store.updateSettings { $0.workout.warmUp.schemes = WarmUpSettings().schemes } }
                    .font(AppFont.medium(15))
                    .frame(maxWidth: .infinity)
                    .foregroundStyle(Theme.destructive)
            }
        }
        .navigationTitle("Warm-Up Scheme")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $editing) { category in
            WarmUpSchemeEditor(category: category, steps: steps(category))
        }
    }

    private func steps(_ category: RestCategory) -> [WarmUpStep] {
        settings.workout.warmUp.schemes[category] ?? WarmUpStep.standard
    }

    private func summary(_ steps: [WarmUpStep]) -> String {
        steps.isEmpty ? "No warm-up sets" : steps.map { "\($0.percent)% target weight x \($0.reps) reps" }.joined(separator: "\n")
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
                            .font(AppFont.headline(13))
                            .frame(width: 30, height: 30)
                            .background(Theme.surfaceRaised, in: .circle)
                        Text("\(steps[index].percent)% of set \(index + 1)")
                            .font(AppFont.caption(13))
                            .frame(maxWidth: .infinity)
                        TextField("Percent", value: $steps[index].percent, format: .percent)
                            .accessibilityLabel("Warm-up set \(index + 1) percent")
                            .frame(width: 56)
                        TextField("Reps", value: $steps[index].reps, format: .number)
                            .accessibilityLabel("Warm-up set \(index + 1) reps")
                            .frame(width: 56)
                    }
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.center)
                }
                .onDelete { steps.remove(atOffsets: $0) }
                Button("Add Warm-Up Set", systemImage: "plus") {
                    let last = steps.last ?? WarmUpStep(percent: 30, reps: 5)
                    steps.append(WarmUpStep(percent: min(last.percent + 10, 100), reps: last.reps))
                }
                .labelStyle(.iconOnly)
                .buttonStyle(.bordered)
                .buttonBorderShape(.circle)
            }
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 8) {
                    Button { save(to: RestCategory.allCases) } label: {
                        Text("Save To All Categories").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    Button { save(to: [category]) } label: {
                        Text("Save").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .foregroundStyle(Theme.background)
                }
                .font(AppFont.headline(16))
                .controlSize(.large)
                .padding()
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 0) {
                        Text("Default Scheme").font(AppFont.headline(17))
                        Text(category.displayName).font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
        .tint(Theme.textPrimary)
        .presentationDetents([.large])
    }

    private func save(to categories: [RestCategory]) {
        let cleaned = steps.map { WarmUpStep(percent: min(max($0.percent, 1), 100), reps: max($0.reps, 1)) }
        store.updateSettings { settings in
            for category in categories { settings.workout.warmUp.schemes[category] = cleaned }
        }
        dismiss()
    }
}
