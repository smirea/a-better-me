import SwiftUI

struct BodyWeightLogSheet: View {
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Observe(AppSettings.current) private var settings
    @Observe(BodyWeight.latest) private var latest
    @State private var weight: Double?
    @State private var bodyFatInput: Double?
    @State private var measuredAt = Date.now
    @FocusState private var focused: Bool

    private var unit: WeightUnit { settings.weightUnit }
    private var value: Double? { weight.flatMap { $0 > 0 ? $0 : nil } }
    /// The scale's body fat, optional; anything outside 1–75% is not a reading.
    private var bodyFat: Double? { bodyFatInput.flatMap { (1...75).contains($0) ? $0 : nil } }

    var body: some View {
        NavigationStack {
            Form {
                ThemedSection(footer: latest.map { "Last weigh-in: \(unit.label(kg: $0.weightKg)), \($0.measuredAt.formatted(.relative(presentation: .named)))" }) {
                    HStack {
                        TextField("Weight", value: $weight, format: .number.precision(.fractionLength(0...2)).grouping(.never))
                            .keyboardType(.decimalPad)
                            .focused($focused)
                            .font(AppFont.number(28))
                            .accessibilityLabel("Weight in \(unit.rawValue)")
                        Text(unit.rawValue).font(AppFont.headline()).foregroundStyle(Theme.textSecondary)
                    }
                    HStack {
                        Text("Body Fat")
                        Spacer()
                        TextField("Optional", value: $bodyFatInput, format: .number)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 90)
                            .accessibilityLabel("Body fat percent")
                        Text("%").foregroundStyle(Theme.textSecondary)
                    }
                    DatePicker("Time", selection: $measuredAt, in: ...Date.now)
                }
            }
            .themedList()
            .detailTitle("Log Weight")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .confirm) {
                        guard let value else { return }
                        var weighIn = BodyWeight(weightKg: unit.toKg(value), measuredAt: measuredAt)
                        weighIn.bodyFatPercent = bodyFat
                        store.insert(weighIn)
                        dismiss()
                    }
                    .disabled(value == nil || (bodyFatInput != nil && bodyFat == nil))
                }
            }
            .onAppear {
                if let latest { weight = (unit.fromKg(latest.weightKg) * 100).rounded() / 100 }
                focused = true
            }
        }
        .presentationDetents([.medium])
    }
}
