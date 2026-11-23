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

    static func clear(_ key: String) {
        UserDefaults.standard.removeObject(forKey: prefix + key)
    }
}

extension View {
    /// Restores a saved draft on appear (when present) and saves changes as the user edits. Pass `enabled: false` when
    /// editing an existing record that shouldn't restore an older draft, or key by record id.
    func persistDraft<Value: Codable & Equatable>(_ draft: Binding<Value>, key: String, enabled: Bool = true) -> some View {
        modifier(PersistDraftModifier(draft: draft, key: key, enabled: enabled))
    }
}

private struct PersistDraftModifier<Value: Codable & Equatable>: ViewModifier {
    @Binding var draft: Value
    let key: String
    let enabled: Bool
    @State private var loaded = false

    func body(content: Content) -> some View {
        content
            .onAppear {
                guard enabled, !loaded else { return }
                loaded = true
                if let saved = DraftStore.load(Value.self, key: key) {
                    draft = saved
                }
            }
            .onChange(of: draft) { _, newValue in
                guard enabled, loaded else { return }
                DraftStore.save(newValue, key: key)
            }
    }
}
