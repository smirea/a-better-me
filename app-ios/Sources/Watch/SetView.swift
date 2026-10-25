import SwiftUI
import WatchKit

/// The set to do next: set dots, the exercise, and a pill per value. The Digital Crown edits the focused pill, the check
/// logs the set with those values, and the phone answers with the next snapshot.
struct SetView: View {
    let row: LiveSet
    let snapshot: LiveWorkoutSnapshot

    @State private var rowID: UUID?
    @State private var values = LiveValues()
    @State private var touched = false
    @State private var focus = LiveField.weight
    @State private var crown = 0.0
    /// The scale index the shown value sits nearest, so focusing a pill doesn't snap an untidy value.
    @State private var crownIndex = 0
    @State private var editTask: Task<Void, Never>?

    private var unit: WeightUnit { snapshot.status.unit }
    private var fields: [LiveField] { row.pills }
    private var scale: [Double] { MetricScale.values(for: focus, unit: unit, loadableKg: snapshot.loadableWeightsKg?[row.blockExerciseID]) }

    var body: some View {
        VStack(spacing: 6) {
            SetDots(set: row, exercise: snapshot.exercises.first { $0.id == row.blockExerciseID })
            Text(row.exerciseName)
                .font(AppFont.headline(16))
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
            if let badge = row.setType.title {
                Text(badge).font(AppFont.caption(11)).foregroundStyle(Theme.accent)
            }
            HStack(spacing: 4) {
                ForEach(fields, id: \.self) { field in
                    MetricPill(field: field, values: values, unit: unit, isFocused: field == focus) { focus = field }
                        .accessibilityAdjustableAction { direction in step(field, by: direction == .increment ? 1 : -1) }
                }
            }
            .focusable()
            .digitalCrownRotation(
                $crown, from: 0, through: Double(max(scale.count - 1, 0)), by: 1,
                sensitivity: .medium, isContinuous: false, isHapticFeedbackEnabled: true
            )
            if let reference = row.target ?? row.previous {
                Text(reference).font(AppFont.caption(11)).foregroundStyle(Theme.textSecondary).lineLimit(1)
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Log set", systemImage: "checkmark", action: logSet)
                .tint(Theme.accent)
                .foregroundStyle(.black)
            }
        }
        .onDebugAction(.check, perform: logSet)
        .onDebugAction(.crownUp) { step(focus, by: 1) }
        .onDebugAction(.crownDown) { step(focus, by: -1) }
        .onDebugAction(.nextField) { focus = fields[((fields.firstIndex(of: focus) ?? 0) + 1) % fields.count] }
        .onAppear { load(row) }
        .onChange(of: row) { _, row in
            if row.id != rowID || !touched { load(row) }
        }
        .onChange(of: focus) { syncCrown() }
        .onChange(of: crown) { _, crown in
            let index = min(max(Int(crown.rounded()), 0), scale.count - 1)
            guard index != crownIndex, scale.indices.contains(index) else { return }
            crownIndex = index
            setValue(scale[index], for: focus)
        }
    }

    private func logSet() {
        WKInterfaceDevice.current().play(.success)
        editTask?.cancel()
        WatchModel.shared.send(.log(rowID: row.id, values: values))
    }

    private func load(_ row: LiveSet) {
        if row.id != rowID {
            rowID = row.id
            touched = false
            focus = fields.first ?? .reps
        }
        values = row.values
        syncCrown()
    }

    private func syncCrown() {
        let current = MetricScale.value(of: focus, in: values) ?? 0
        let nearest = scale.indices.min { abs(scale[$0] - current) < abs(scale[$1] - current) } ?? 0
        crownIndex = nearest
        crown = Double(nearest)
    }

    private func step(_ field: LiveField, by delta: Int) {
        focus = field
        let target = min(max(Int(crown.rounded()) + delta, 0), scale.count - 1)
        crown = Double(target)
    }

    private func setValue(_ value: Double, for field: LiveField) {
        var next = values
        MetricScale.set(value, of: field, in: &next)
        guard next != values else { return }
        values = next
        touched = true
        editTask?.cancel()
        let rowID = row.id
        editTask = Task {
            try? await Task.sleep(for: .seconds(1))
            guard !Task.isCancelled else { return }
            WatchModel.shared.send(.edit(rowID: rowID, values: next))
        }
    }
}

/// What the crown steps through for each value. Weight steps through what the exercise's equipment loads in the gym,
/// else 2.5 lb or 1.25 kg at a time.
enum MetricScale {
    static func values(for field: LiveField, unit: WeightUnit, loadableKg: [Double]?) -> [Double] {
        switch field {
        case .weight:
            if let loadableKg, !loadableKg.isEmpty { return [0] + loadableKg }
            let step = unit == .kg ? 1.25 : 2.5
            return (0...400).map { unit.toKg(Double($0) * step) }
        case .reps: return (0...100).map(Double.init)
        case .rir: return (0...10).map(Double.init)
        case .duration: return (0...720).map { Double($0 * 5) }
        case .distance: return (0...1000).map { Double($0 * 10) }
        }
    }

    static func value(of field: LiveField, in values: LiveValues) -> Double? {
        switch field {
        case .weight: values.weightKg
        case .reps: values.reps.map(Double.init)
        case .rir: values.rir.map(Double.init)
        case .duration: values.durationSeconds.map(Double.init)
        case .distance: values.distanceMeters
        }
    }

    static func set(_ value: Double, of field: LiveField, in values: inout LiveValues) {
        switch field {
        case .weight: values.weightKg = value
        case .reps: values.reps = Int(value)
        case .rir: values.rir = Int(value)
        case .duration: values.durationSeconds = Int(value)
        case .distance: values.distanceMeters = value
        }
    }

    /// The pill's number and caption: "175" over "LB".
    static func text(_ field: LiveField, in values: LiveValues, unit: WeightUnit) -> (value: String, caption: String) {
        switch field {
        case .weight: (values.weightKg.map { unit.fromKg($0).formatted(.number.precision(.fractionLength(0...1))) } ?? "–", unit.rawValue.uppercased())
        case .reps: (values.reps.map(String.init) ?? "–", "REPS")
        case .rir: (values.rir.map { $0 >= 6 ? "6+" : "\($0)" } ?? "–", "RIR")
        case .duration: (values.durationSeconds.map { Duration.seconds($0).formatted(.time(pattern: .minuteSecond)) } ?? "–", "TIME")
        case .distance: (values.distanceMeters.map { $0.formatted(.number.precision(.fractionLength(0))) } ?? "–", "M")
        }
    }
}

struct MetricPill: View {
    let field: LiveField
    let values: LiveValues
    let unit: WeightUnit
    var isFocused = false
    var action: (() -> Void)?

    var body: some View {
        let text = MetricScale.text(field, in: values, unit: unit)
        Button {
            action?()
        } label: {
            VStack(spacing: 0) {
                Text(text.value).font(AppFont.number(20)).lineLimit(1).minimumScaleFactor(0.5)
                Text(text.caption).font(AppFont.caption(10)).foregroundStyle(isFocused ? Theme.accent : Theme.textSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(Theme.accent.opacity(isFocused ? 0.3 : 0.15), in: Capsule())
            .overlay(Capsule().strokeBorder(isFocused ? Theme.accent : .clear, lineWidth: 2))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(text.caption.capitalized) \(text.value)")
    }
}

/// One numbered dot per row of the exercise: logged ones in the accent, the current one white.
private struct SetDots: View {
    let set: LiveSet
    let exercise: LiveExercise?

    var body: some View {
        if let exercise, exercise.totalSets <= 6 {
            HStack(spacing: 5) {
                ForEach(0..<exercise.totalSets, id: \.self) { index in
                    let isCurrent = index == exercise.completedSets
                    Text("\(index + 1)")
                        .font(AppFont.headline(11))
                        .foregroundStyle(isCurrent ? .black : Theme.textPrimary)
                        .frame(width: 20, height: 20)
                        .background(isCurrent ? Theme.textPrimary : index < exercise.completedSets ? Theme.accent.opacity(0.6) : Theme.surfaceRaised, in: Circle())
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(set.position)
        } else {
            Text(set.position.uppercased()).font(AppFont.caption(11)).foregroundStyle(Theme.textSecondary)
        }
    }
}

extension LiveSet {
    /// The values the row logs, in MF's order: weight, reps, then RIR wherever reps are logged.
    var pills: [LiveField] {
        let order: [LiveField] = [.weight, .reps, .duration, .distance]
        return order.filter(fields.contains) + (fields.contains(.reps) ? [.rir] : [])
    }
}

extension SetType {
    /// The caption above a set that isn't a standard one, as on MF's rest card.
    var title: String? {
        switch self {
        case .standard: nil
        case .warmUp: "WARM-UP SET"
        case .drop: "DROP SET"
        case .myo: "MYO SET"
        case .failure: "FAILURE SET"
        }
    }
}
