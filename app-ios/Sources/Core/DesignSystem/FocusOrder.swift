import Foundation

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

extension FocusOrder: Sendable where Field: Sendable {}
