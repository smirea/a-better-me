import SwiftUI

/// MacroFactor's Full Body entry: one date and a field per visible measurement, visual body fat always. A field left
/// empty keeps the day's stored value; clearing a stored value deletes it.
struct BodyMetricsLogSheet: View {
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Observe(AppSettings.current) private var settings
    @Observe(BodyMetric.all) private var metrics
    @State private var date = Date.now
    @State private var texts: [BodyMetricKind: String] = [:]
    @State private var showingReference = false

    private var day: CalendarDay { CalendarDay(date) }
    private var heightUnit: NutritionSettings.HeightUnit { settings.nutrition.heightUnit }
    private var kinds: [BodyMetricKind] {
        BodyMetricCard.available(visible: settings.nutrition.visibleBodyMetrics).compactMap(\.kind)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Date", selection: $date, in: ...Date.now, displayedComponents: .date)
                }
                .listRowBackground(Theme.surface)
                Section {
                    ForEach(kinds, id: \.self) { kind in
                        HStack {
                            Text(kind.title)
                            if kind == .visualBodyFat {
                                Button("Reference", systemImage: "photo.on.rectangle") { showingReference = true }
                                    .labelStyle(.iconOnly)
                                    .foregroundStyle(Theme.textSecondary)
                            }
                            Spacer()
                            TextField(stored(kind) ?? "--", text: binding(kind))
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                                .frame(width: 90)
                                .accessibilityLabel("\(kind.title) in \(unit(kind))")
                            Text(unit(kind)).foregroundStyle(Theme.textSecondary).frame(width: 30, alignment: .leading)
                        }
                    }
                } footer: {
                    Text("Turn on more measurements in Settings > Data Visibility > Body Metrics.")
                }
                .listRowBackground(Theme.surface)
            }
            .themedList()
            .navigationTitle("Log Measurements")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", systemImage: "xmark") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", systemImage: "checkmark") {
                        save()
                        dismiss()
                    }
                    .disabled(texts.isEmpty)
                }
            }
            .onChange(of: day) { texts = [:] }
            .sheet(isPresented: $showingReference) { BodyFatReferenceSheet() }
        }
    }

    private func unit(_ kind: BodyMetricKind) -> String { kind.isLength ? heightUnit.lengthLabel : "%" }

    private func stored(_ kind: BodyMetricKind) -> String? {
        metrics.first { $0.kind == kind && $0.day == day }.map { (kind.isLength ? heightUnit.fromCm($0.value) : $0.value).dashboardText }
    }

    private func binding(_ kind: BodyMetricKind) -> Binding<String> {
        Binding(get: { texts[kind] ?? "" }, set: { texts[kind] = $0 })
    }

    private func save() {
        for (kind, text) in texts {
            let trimmed = text.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty {
                store.setBodyMetric(kind, on: day, value: nil)
            } else if let value = Double(trimmed.replacing(",", with: ".")), value > 0 {
                store.setBodyMetric(kind, on: day, value: kind.isLength ? heightUnit.toCm(value) : value)
            }
        }
    }
}

/// MacroFactor shows nine illustrated torsos; their art is not in the bundle, so the ranges and what they look like
/// are described instead.
private struct BodyFatReferenceSheet: View {
    @Environment(\.dismiss) private var dismiss

    private static let ranges: [(String, String)] = [
        ("3–4%", "Extreme vascularity; competition-level conditioning"),
        ("5–7%", "Striations and veins across most muscles"),
        ("8–12%", "Clear abs and muscle separation"),
        ("13–17%", "Outline of abs, some definition"),
        ("18–23%", "Little definition, soft midsection"),
        ("24–29%", "Rounder shape, fat around waist and hips"),
        ("30–34%", "Noticeable fat on waist, hips, and limbs"),
        ("35–39%", "Larger waist and limb circumference"),
        ("40%+", "Fat accumulates broadly across the body"),
    ]

    var body: some View {
        NavigationStack {
            List(Self.ranges, id: \.0) { range, description in
                LabeledContent(range, value: description).listRowBackground(Theme.surface)
            }
            .themedList()
            .navigationTitle("Body Fat Reference")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", systemImage: "checkmark") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
