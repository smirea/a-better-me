import SwiftUI

/// Persists a `Set<UUID>` in `UserDefaults` (e.g. expanded or collapsed rows) so UI state survives reloads and locks.
@propertyWrapper
struct PersistedIDSet: DynamicProperty {
    @AppStorage private var raw: String

    init(_ key: String) {
        _raw = AppStorage(wrappedValue: "", key)
    }

    var wrappedValue: Set<UUID> {
        get {
            guard !raw.isEmpty else { return [] }
            return Set(raw.split(separator: ",").compactMap { UUID(uuidString: String($0)) })
        }
        nonmutating set {
            raw = newValue.map(\.uuidString).sorted().joined(separator: ",")
        }
    }

    var projectedValue: Binding<Set<UUID>> {
        Binding(get: { wrappedValue }, set: { wrappedValue = $0 })
    }

    func contains(_ id: UUID) -> Bool {
        wrappedValue.contains(id)
    }

    func toggle(_ id: UUID) {
        var next = wrappedValue
        if !next.insert(id).inserted { next.remove(id) }
        wrappedValue = next
    }
}

/// Persists in-progress `Codable` form drafts in `UserDefaults` so closing the phone or restarting never wipes an
/// unsaved sheet. Call `DraftStore.clear(key)` when the form saves or is explicitly discarded.
enum DraftStore {
    private static let prefix = "draft."

    static func load<Value: Decodable>(_ type: Value.Type, key: String) -> Value? {
        guard let data = UserDefaults.standard.data(forKey: prefix + key) else { return nil }
        return try? JSONDecoder().decode(Value.self, from: data)
    }

    static func save<Value: Encodable>(_ value: Value, key: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        UserDefaults.standard.set(data, forKey: prefix + key)
    }

    static func clear(_ key: String?) {
        guard let key else { return }
        UserDefaults.standard.removeObject(forKey: prefix + key)
    }
}

extension View {
    /// Restores the draft saved under `key` on appear and saves every change, so a form survives the app being killed
    /// and SwiftUI rebuilding the sheet. A nil key persists nothing: a form opened prefilled from something else (a
    /// duplicate, a scan, a selection) must not be replaced by an older draft. `restored` runs after a saved draft
    /// replaces the opened one.
    ///
    /// A draft is kept with the form as it opened and restores only over that same form: once the record changed
    /// elsewhere (Stop Taking, a sync) or a new form's defaults moved on (a new day's start), the draft is dropped rather
    /// than reverting the change on the next save. A draft edited back to how the form opened is dropped too, since a
    /// swipe can then close the sheet without clearing it. Rows built from a record need stable ids
    /// (`UUID(draftRow:)`) for the two forms to compare equal.
    func persistDraft<Value: Codable & Equatable>(_ draft: Binding<Value>, key: String?, restored: (() -> Void)? = nil) -> some View {
        modifier(PersistDraftModifier(draft: draft, key: key, restored: restored))
    }
}

private struct SavedDraft<Value: Codable>: Codable {
    var opened: Value
    var draft: Value
}

private struct PersistDraftModifier<Value: Codable & Equatable>: ViewModifier {
    @Binding var draft: Value
    let key: String?
    let restored: (() -> Void)?
    @State private var opened: Value?

    func body(content: Content) -> some View {
        content
            .onAppear {
                guard let key, opened == nil else { return }
                opened = draft
                guard let saved = DraftStore.load(SavedDraft<Value>.self, key: key), saved.opened == draft else {
                    DraftStore.clear(key)
                    return
                }
                draft = saved.draft
                restored?()
            }
            .onChange(of: draft) { _, newValue in
                guard let key, let opened else { return }
                if newValue == opened {
                    DraftStore.clear(key)
                } else {
                    DraftStore.save(SavedDraft(opened: opened, draft: newValue), key: key)
                }
            }
    }
}
