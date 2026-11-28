import SwiftUI

/// The round + that adds a food without leaving the list, MacroFactor's Multi-Add: a 26 pt circle in a 44 pt target that
/// turns into a check for a moment after each add.
struct AddFoodButton: View {
    let food: FoodSnapshot
    let add: () -> Void
    @State private var added = 0
    @State private var showsCheck = false

    var body: some View {
        RowActionButton(title: "Add \(food.name)", systemImage: showsCheck ? "checkmark" : "plus", isOn: showsCheck) {
            added += 1
            add()
        }
        .accessibilityValue(showsCheck ? "Added" : "")
        .task(id: added) {
            guard added > 0 else { return }
            withAnimation(.snappy) { showsCheck = true }
            try? await Task.sleep(for: .seconds(1.2))
            guard !Task.isCancelled else { return }
            withAnimation(.snappy) { showsCheck = false }
        }
    }
}
