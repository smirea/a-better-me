import Foundation

/// Parses a typed number, accepting a comma decimal separator. Empty text is nil, as is anything that is not a
/// number; `isNumber` tells the two apart.
enum NumberText {
    static func parse(_ text: String) -> Double? {
        let trimmed = text.trimmingCharacters(in: .whitespaces).replacing(",", with: ".")
        return trimmed.isEmpty ? nil : Double(trimmed)
    }

    static func text(_ value: Double?) -> String {
        value.map { $0.formatted(.number.precision(.fractionLength(0...3)).grouping(.never).locale(Locale(identifier: "en_US_POSIX"))) } ?? ""
    }
}
