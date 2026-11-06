/// One derived value cached in a view's `@State` until its key changes, so `body` reads it instead of recomputing it.
/// The key must hold every input the computation reads.
final class ViewMemo<Key: Equatable, Value> {
    private var cached: (key: Key, value: Value)?

    func callAsFunction(_ key: Key, _ compute: () -> Value) -> Value {
        if let cached, cached.key == key { return cached.value }
        let value = compute()
        cached = (key, value)
        return value
    }
}
