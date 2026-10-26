import Foundation

/// The quantity keypad's text: digits, a decimal point, a fraction ("3/4"), and a mixed number ("1 1/2"), the forms
/// MacroFactor's keypad types. The first key replaces the shown value, as if it were selected.
struct QuantityText: Hashable, Sendable {
    enum Key: Hashable, Sendable {
        case digit(Int), point, slash, space, backspace
    }

    private(set) var text: String
    private(set) var replacesOnType = true
    /// The exact value until the first key, since the shown text rounds it ("1/3" shows as 0.33).
    private var untouched: Double?

    static let maxLength = 8

    init(_ value: Double) {
        text = Self.format(value)
        untouched = value
    }

    init(text: String) {
        self.text = text
        replacesOnType = false
    }

    var value: Double? { untouched ?? Self.parse(text) }

    mutating func type(_ key: Key) {
        untouched = nil
        if replacesOnType {
            replacesOnType = false
            if key == .backspace {
                text = ""
                return
            }
            text = ""
        }
        let whole = text.split(separator: " ", omittingEmptySubsequences: false)
        let last = whole.last.map(String.init) ?? ""
        switch key {
        case let .digit(digit):
            guard text.count < Self.maxLength else { return }
            text = text == "0" ? String(digit) : text + String(digit)
        case .point:
            guard text.count < Self.maxLength, !last.contains("."), !last.contains("/") else { return }
            text += last.isEmpty ? "0." : "."
        case .slash:
            guard !last.isEmpty, !last.contains("/"), !last.contains("."), text.count < Self.maxLength else { return }
            text += "/"
        case .space:
            guard !text.isEmpty, whole.count == 1, !text.contains("/"), !text.contains("."), text.count < Self.maxLength else { return }
            text += " "
        case .backspace:
            text = String(text.dropLast())
        }
    }

    /// "2", "0.5", ".5", "3/4", or "1 1/2". Nil for anything else, including a zero denominator.
    static func parse(_ text: String) -> Double? {
        let parts = text.split(separator: " ")
        switch parts.count {
        case 1:
            return number(parts[0])
        case 2:
            guard parts[1].contains("/"), !parts[0].contains("/"), !parts[0].contains("."),
                  let whole = Double(parts[0]), let fraction = fraction(parts[1]) else { return nil }
            return whole + fraction
        default:
            return nil
        }
    }

    private static func number(_ part: Substring) -> Double? {
        part.contains("/") ? fraction(part) : Double(part)
    }

    private static func fraction(_ part: Substring) -> Double? {
        let sides = part.split(separator: "/", omittingEmptySubsequences: false)
        guard sides.count == 2, let top = Double(sides[0]), let bottom = Double(sides[1]), bottom != 0,
              !sides[0].contains("."), !sides[1].contains(".") else { return nil }
        return top / bottom
    }

    /// Up to two decimals, no grouping, a point whatever the locale, since the keypad types ".".
    static func format(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...2)).grouping(.never).locale(Locale(identifier: "en_US_POSIX")))
    }
}
