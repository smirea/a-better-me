import SwiftUI
import WatchKit

/// The set to do next: the exercise, its sets as dots, and a pill per value. Tap a pill and turn the Digital Crown to
/// change it; the big button logs the set with those values.
struct SetView: View {
    let workout: WatchWorkout
    let path: RowPath
    let showExercises: () -> Void

    @State private var rowID: UUID?
    @State private var values = LiveValues()
    @State private var focus = LiveField.weight
    @State private var crown = 0.0
    /// The scale index the shown value sits nearest, so focusing a pill doesn't snap an untidy value.
    @State private var crownIndex = 0

    private var row: LiveSet { workout.set(at: path) }
    private var item: BlockExercise { workout.blocks[path.block].exercises[path.exercise] }
    private var fields: [LiveField] { row.pills }
    private var scale: [Double] { MetricScale.values(for: focus, unit: workout.unit, loadableKg: workout.exercise(item.exerciseID).loadableWeightsKg) }

    var body: some View {
        VStack(spacing: 6) {
            Button(action: showExercises) {
                SetHeader(workout: workout, path: path, row: row)
            }
            .buttonStyle(.plain)
            .accessibilityHint("Shows the workout's exercises")
            HStack(spacing: 4) {
                ForEach(fields, id: \.self) { field in
                    MetricPill(field: field, values: values, unit: workout.unit, isFocused: field == focus) { focus = field }
                        .accessibilityAdjustableAction { direction in step(field, by: direction == .increment ? 1 : -1) }
                }
            }
            .focusable()
            .digitalCrownRotation(
                $crown, from: 0, through: Double(max(scale.count - 1, 0)), by: 1,
                sensitivity: .medium, isContinuous: false, isHapticFeedbackEnabled: true
            )
            if let reference = reference {
                Text(reference)
                    .font(AppFont.caption(11))
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
        }
        .toolbar {
            ToolbarItem(placement: .bottomBar) {
                Button(action: logSet) {
                    Label(logTitle, systemImage: "checkmark")
                        .font(AppFont.headline(16))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.glassProminent)
                .tint(Theme.accent)
                .accessibilityLabel("Log set")
            }
        }
        .onAppear { load() }
        .onChange(of: row.id) { load() }
        .onChange(of: focus) { syncCrown() }
        .onChange(of: crown) { _, crown in
            let index = min(max(Int(crown.rounded()), 0), scale.count - 1)
            guard index != crownIndex, scale.indices.contains(index) else { return }
            crownIndex = index
            MetricScale.set(scale[index], of: focus, in: &values)
        }
    }

    private var logTitle: String {
        switch row.setType {
        case .warmUp: "Log Warm-Up"
        case .drop where row.isSubRow: "Log Drop"
        default: "Log Set"
        }
    }

    private var reference: String? {
        if let previous = row.previous { return "Last \(previous)" }
        return row.target.map { "Target \($0)" }
    }

    private func logSet() {
        WatchModel.shared.act(.log(rowID: row.id, values: values))
    }

    private func load() {
        guard row.id != rowID else { return }
        let sameExercise = rowID.flatMap { workout.blocks.path(of: $0) }.map { workout.blocks[$0.block].exercises[$0.exercise].id == item.id } ?? false
        rowID = row.id
        values = row.values
        if !sameExercise || !fields.contains(focus) { focus = fields.first ?? .reps }
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
        crown = Double(min(max(Int(crown.rounded()) + delta, 0), scale.count - 1))
    }
}

/// The exercise, then one row with a superset member's letter, the exercise's sets as dots, and the set type.
struct SetHeader: View {
    let workout: WatchWorkout
    let path: RowPath
    let row: LiveSet

    var body: some View {
        let block = workout.blocks[path.block]
        let item = block.exercises[path.exercise]
        VStack(spacing: 4) {
            Text(row.exerciseName)
                .font(AppFont.headline(15))
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 5) {
                if block.isSuperset { MemberBadge(member: path.exercise) }
                SetDots(sets: item.sets, current: path.set)
                if let title = row.setType.title(isSubRow: row.isSubRow) {
                    Text(title).font(AppFont.headline(9)).foregroundStyle(row.setType.tint).lineLimit(1)
                }
            }
        }
    }
}

/// A superset or circuit member's letter, A for the first.
struct MemberBadge: View {
    let member: Int

    var body: some View {
        Text(String(UnicodeScalar(UInt8(65 + member))))
            .font(AppFont.headline(10))
            .foregroundStyle(.black)
            .frame(width: 18, height: 18)
            .background(Theme.lavender, in: RoundedRectangle(cornerRadius: 5))
            .accessibilityLabel("Superset exercise \(String(UnicodeScalar(UInt8(65 + member))))")
    }
}

/// One dot per set: logged ones filled, the current one white with its number, warm-ups marked W.
struct SetDots: View {
    let sets: [WorkoutSet]
    let current: Int

    var body: some View {
        HStack(spacing: 4) {
            ForEach(Array(sets.prefix(8).enumerated()), id: \.element.id) { index, set in
                let isCurrent = index == current
                Text(set.type.badge ?? "\(sets.number(at: index))")
                    .font(AppFont.headline(10))
                    .foregroundStyle(isCurrent ? .black : set.isDone ? .black : Theme.textSecondary)
                    .frame(width: 18, height: 18)
                    .background(isCurrent ? Theme.textPrimary : set.isDone ? Theme.accent : Theme.surfaceRaised, in: Circle())
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Set \(current + 1) of \(sets.count)")
    }
}

/// What the crown steps through for each value. Weight steps through what the exercise's equipment loads in the gym,
/// else 2.5 lb or 1.25 kg at a time; RIR runs 0 to 6, where 6 means 6 or more.
enum MetricScale {
    static func values(for field: LiveField, unit: WeightUnit, loadableKg: [Double]?) -> [Double] {
        switch field {
        case .weight:
            if let loadableKg, !loadableKg.isEmpty { return [0] + loadableKg }
            let step = unit == .kg ? 1.25 : 2.5
            return (0...400).map { unit.toKg(Double($0) * step) }
        case .reps: return (0...100).map(Double.init)
        case .rir: return (0...6).map(Double.init)
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
        let tint = field == .rir && values.rir != nil ? Theme.rir(values.rir) : Theme.accent
        Button {
            action?()
        } label: {
            VStack(spacing: 0) {
                Text(text.value).font(AppFont.number(22)).lineLimit(1).minimumScaleFactor(0.5)
                Text(text.caption).font(AppFont.headline(9)).foregroundStyle(isFocused ? tint : Theme.textSecondary)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(tint.opacity(isFocused ? 0.32 : 0.14), in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(isFocused ? tint : .clear, lineWidth: 2))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(text.caption.capitalized) \(text.value)")
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
    /// The caption beside a set that isn't a standard one, as on MF's rest card.
    func title(isSubRow: Bool = false) -> String? {
        switch self {
        case .standard: nil
        case .warmUp: "WARM-UP"
        case .drop: isSubRow ? "DROP" : "DROP SET"
        case .myo: isSubRow ? "MYO REP" : "MYO SET"
        case .failure: "TO FAILURE"
        }
    }

    var tint: Color {
        switch self {
        case .warmUp: Theme.amber
        case .failure: Theme.destructive
        default: Theme.accent
        }
    }
}
