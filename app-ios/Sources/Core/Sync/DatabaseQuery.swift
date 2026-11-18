import GRDB

/// What a screen observes: a fetch over the local database and the value shown until the first read lands.
struct DatabaseQuery<Value: Sendable & Equatable>: Sendable {
    let placeholder: Value
    let fetch: @Sendable (Database) throws -> Value

    init(_ placeholder: Value, _ fetch: @escaping @Sendable (Database) throws -> Value) {
        self.placeholder = placeholder
        self.fetch = fetch
    }
}
