import SwiftUI

extension NutrientID {
    /// The banner's and the plate's short names.
    var macroLetter: String {
        switch self {
        case .energy: "kcal"
        case .protein: "P"
        case .fat: "F"
        case .carbs: "C"
        default: NutrientRegistry.nutrient(self)?.short ?? rawValue
        }
    }
}

/// The round + that puts a food on the plate without leaving the list, MacroFactor's Multi-Add: a 26 pt circle in a
/// 44 pt target that turns into a check for a moment after each add.
struct AddToPlateButton: View {
    let food: FoodSnapshot
    let add: () -> Void
    @State private var added = 0
    @State private var showsCheck = false

    var body: some View {
        Button {
            added += 1
            add()
        } label: {
            Image(systemName: showsCheck ? "checkmark" : "plus")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(showsCheck ? Theme.onPrimary : Theme.textPrimary)
                .contentTransition(.symbolEffect(.replace))
                .frame(width: 26, height: 26)
                .background(showsCheck ? Theme.textPrimary : Theme.surfaceRaised, in: .circle)
                .frame(width: 44, height: 44)
                .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add \(food.name) to plate")
        .accessibilityValue(showsCheck ? "Added" : "")
        .sensoryFeedback(.success, trigger: added)
        .task(id: added) {
            guard added > 0 else { return }
            withAnimation(.snappy) { showsCheck = true }
            try? await Task.sleep(for: .seconds(1.2))
            guard !Task.isCancelled else { return }
            withAnimation(.snappy) { showsCheck = false }
        }
    }
}

/// The logger's one action everywhere: log what is on the plate.
struct LogFoodsButton: View {
    let session: LoggerSession
    /// Runs before logging, so a tab can put its own food on the plate first (Quick Add's form).
    var prepare: () -> Void = {}
    /// The tab holds a food `prepare` adds, so an empty plate can still log.
    var hasPending = false

    var body: some View {
        Button("Log Foods") {
            prepare()
            session.logPlate()
        }
        .font(AppFont.headline(15))
        .buttonStyle(.glassProminent)
        .tint(Theme.textPrimary)
        .foregroundStyle(Theme.onPrimary)
        .disabled(session.plate.isEmpty && !hasPending)
    }
}
