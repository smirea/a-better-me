import SwiftUI

/// The round + that puts a food on the plate without leaving the list, MacroFactor's Multi-Add: a 26 pt circle in a
/// 44 pt target that turns into a check for a moment after each add.
struct AddToPlateButton: View {
    let food: FoodSnapshot
    let add: () -> Void
    @State private var added = 0
    @State private var showsCheck = false

    var body: some View {
        RowActionButton(title: "Add \(food.name) to plate", systemImage: showsCheck ? "checkmark" : "plus", isOn: showsCheck) {
            added += 1
            add()
        }
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
        .prominentButton()
        .disabled(session.plate.isEmpty && !hasPending)
    }
}
