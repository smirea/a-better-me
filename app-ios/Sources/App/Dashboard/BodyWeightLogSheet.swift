import SwiftUI

struct BodyWeightLogSheet: View {
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Observe(AppSettings.current) private var settings
    @Observe(BodyWeight.latest) private var latest
    @State private var text = ""
    @State private var measuredAt = Date.now
    @FocusState private var focused: Bool

    private var unit: WeightUnit { settings.weightUnit }
    private var value: Double? { Double(text.replacing(",", with: ".")).flatMap { $0 > 0 ? $0 : nil } }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        TextField("Weight", text: $text)
                            .keyboardType(.decimalPad)
                            .focused($focused)
                            .font(AppFont.number(28))
                            .accessibilityLabel("Weight in \(unit.rawValue)")
                        Text(unit.rawValue).font(AppFont.headline()).foregroundStyle(Theme.textSecondary)
                    }
                    DatePicker("Time", selection: $measuredAt, in: ...Date.now)
                } footer: {
                    if let latest {
                        Text("Last weigh-in: \(unit.format(kg: latest.weightKg)) \(unit.rawValue), \(latest.measuredAt.formatted(.relative(presentation: .named)))")
                    }
                }
                .listRowBackground(Theme.surface)
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("Log Weight")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", systemImage: "xmark") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", systemImage: "checkmark") {
                        guard let value else { return }
                        store.insert(BodyWeight(weightKg: unit.toKg(value), measuredAt: measuredAt))
                        dismiss()
                    }
                    .disabled(value == nil)
                }
            }
            .onAppear {
                if let latest { text = unit.fromKg(latest.weightKg).formatted(.number.precision(.fractionLength(0...2)).grouping(.never)) }
                focused = true
            }
        }
        .presentationDetents([.medium])
    }
}
