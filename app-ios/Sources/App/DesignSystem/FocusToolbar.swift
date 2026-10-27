import SwiftUI

/// A form's fields in the order the keyboard's previous and next buttons walk them.
struct FocusOrder<Field: Hashable> {
    let fields: [Field]

    init(_ fields: [Field]) { self.fields = fields }

    func field(after current: Field?) -> Field? { step(from: current, by: 1) }
    func field(before current: Field?) -> Field? { step(from: current, by: -1) }

    private func step(from current: Field?, by offset: Int) -> Field? {
        guard let current, let index = fields.firstIndex(of: current), fields.indices.contains(index + offset) else { return nil }
        return fields[index + offset]
    }
}

extension View {
    /// The keyboard's bar while a field of `order` is focused: previous and next through it, then `actions`, then Done.
    /// The decimal pad has no return key, so without it every field is its own tap and the keyboard never leaves.
    func focusToolbar<Field: Hashable, Actions: View>(
        _ order: FocusOrder<Field>, focus: FocusState<Field?>.Binding, @ViewBuilder actions: () -> Actions = { EmptyView() }
    ) -> some View {
        let actions = actions()
        return toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                if focus.wrappedValue != nil {
                    Button("Previous Field", systemImage: "chevron.up") { focus.wrappedValue = order.field(before: focus.wrappedValue) }
                        .disabled(order.field(before: focus.wrappedValue) == nil)
                    Button("Next Field", systemImage: "chevron.down") { focus.wrappedValue = order.field(after: focus.wrappedValue) }
                        .disabled(order.field(after: focus.wrappedValue) == nil)
                    Spacer()
                    actions
                    Button("Done") { focus.wrappedValue = nil }
                        .fontWeight(.semibold)
                }
            }
        }
    }
}

extension FocusOrder: Sendable where Field: Sendable {}
