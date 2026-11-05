import Foundation

/// Typed numbers: parsing accepts a comma decimal separator, and empty text or anything that is not a number is nil.
/// Screens show numbers with `Double.niceText` and `wholeText` below.
enum NumberText {
    static func parse(_ text: String) -> Double? {
        let trimmed = text.trimmingCharacters(in: .whitespaces).replacing(",", with: ".")
        return trimmed.isEmpty ? nil : Double(trimmed)
    }

    static func text(_ value: Double?) -> String {
        value.map { $0.formatted(.number.precision(.fractionLength(0...3)).grouping(.never).locale(Locale(identifier: "en_US_POSIX"))) } ?? ""
    }
}

extension Double {
    /// Whole with grouping, "2,345": calories, steps, percentages, and anything else that never wants a decimal.
    var wholeText: String {
        let whole = rounded()
        return (whole == 0 ? 0 : whole).formatted(.number.precision(.fractionLength(0)))
    }

    /// One decimal under 10 and whole from there: "6.7", "5", "33", "1,509". A trace amount reads "<0.1" rather than
    /// zero, so a vitamin with a small target never looks absent. Weights and distances keep their own precision.
    var niceText: String {
        let tenths = (self * 10).rounded() / 10
        if tenths == 0 { return self > 0 ? "<0.1" : "0" }
        return abs(tenths) < 10 ? tenths.formatted(.number.precision(.fractionLength(0...1))) : wholeText
    }
}
