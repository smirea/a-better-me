import SwiftUI

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
