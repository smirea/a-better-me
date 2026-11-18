import Foundation

/// A scanned or typed barcode, read for what identifies the food. A store-packed item (deli, meat, cheese, bakery)
/// carries the store's item code plus this package's price or weight: GS1 numbers starting with 2 (a UPC-A `2 IIIII
/// PPPPP C`, an EAN-13 `2X…`, or the same inside a GS1-128 or DataBar's `(01)` GTIN). `code` keeps only the item, so
/// every package of it finds one food, and the item code alone never reaches Open Food Facts.
struct ScannedBarcode: Hashable, Sendable {
    let code: String
    let isStoreItem: Bool
    /// The package's net weight, when the barcode encodes one (GS1 `310n` kilograms or `320n` pounds).
    let grams: Double?

    init(code: String, isStoreItem: Bool, grams: Double?) {
        self.code = code
        self.isStoreItem = isStoreItem
        self.grams = grams
    }

    init?(_ text: String) {
        var text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        // A reader may prefix the AIM symbology identifier: ]C1 is GS1-128, ]e0 DataBar.
        if text.hasPrefix("]"), text.count > 3 { text.removeFirst(3) }
        let fields: [String: String]
        if text.contains("(") {
            guard let parsed = Self.parenthesized(text) else { return nil }
            fields = parsed
        } else {
            let digits = text.filter { $0 != " " && $0 != "-" }
            if digits.contains(Self.groupSeparator) || digits.count > 14 {
                guard let parsed = Self.elementString(digits) else { return nil }
                fields = parsed
            } else {
                guard (8...14).contains(digits.count), digits.allSatisfy({ $0.isASCII && $0.isNumber }) else { return nil }
                self.init(gtin: digits, grams: nil)
                return
            }
        }
        guard let gtin = fields["01"], gtin.count == 14, gtin.allSatisfy({ $0.isASCII && $0.isNumber }) else { return nil }
        self.init(gtin: gtin.first == "0" ? String(gtin.dropFirst()) : gtin, grams: Self.grams(fields))
    }

    private init(gtin: String, grams: Double?) {
        let ean13 = switch gtin.count {
        case 12: "0" + gtin
        case 14 where gtin.hasPrefix("0"): String(gtin.dropFirst())
        default: gtin
        }
        if ean13.count == 13, ean13.hasPrefix("02") {
            self.init(code: String(ean13.dropFirst().prefix(6)), isStoreItem: true, grams: grams)
        } else if ean13.count == 13, ean13.hasPrefix("2") {
            self.init(code: String(ean13.prefix(7)), isStoreItem: true, grams: grams)
        } else {
            self.init(code: gtin, isStoreItem: false, grams: grams)
        }
    }

    private static let groupSeparator: Character = "\u{1D}"

    /// The fixed-length application identifiers a food label can carry before a variable one; anything else ends the
    /// walk, which is safe because the GTIN comes first on every label.
    private static func fixedLength(_ ai: Substring) -> Int? {
        switch ai.prefix(2) {
        case "00": return 18
        case "01", "02": return 14
        case "11", "12", "13", "15", "16", "17": return 6
        case "31", "32", "33", "34", "35", "36": return 6
        default: return nil
        }
    }

    /// The application identifiers whose value has no fixed length, ended by a group separator or the string's end.
    private static let variableAIs: Set<Substring> = ["10", "21", "22", "30", "37", "240", "241", "250", "251", "400", "401", "403", "420", "8020"]

    /// `0100210843000000<GS>39040079900`: AIs read in order, fixed ones by length, the rest up to a separator.
    private static func elementString(_ digits: String) -> [String: String]? {
        var fields: [String: String] = [:]
        var rest = Substring(digits.drop { $0 == groupSeparator })
        while !rest.isEmpty {
            let aiLength: Int
            let valueLength: Int?
            if let fixed = fixedLength(rest) {
                aiLength = ["31", "32", "33", "34", "35", "36"].contains(rest.prefix(2)) ? 4 : 2
                valueLength = fixed
            } else if rest.hasPrefix("39") || rest.hasPrefix("70") {
                aiLength = 4
                valueLength = nil
            } else if let ai = [4, 3, 2].lazy.map({ rest.prefix($0) }).first(where: variableAIs.contains) {
                aiLength = ai.count
                valueLength = nil
            } else {
                break
            }
            let ai = String(rest.prefix(aiLength))
            rest = rest.dropFirst(aiLength)
            let value: Substring
            if let valueLength {
                guard rest.count >= valueLength else { return nil }
                value = rest.prefix(valueLength)
                rest = rest.dropFirst(valueLength)
            } else {
                value = rest.prefix { $0 != groupSeparator }
                rest = rest.dropFirst(value.count)
            }
            rest = rest.drop { $0 == groupSeparator }
            fields[ai] = String(value)
        }
        return fields.isEmpty ? nil : fields
    }

    /// `(01)00210843000000(3904)0079900`, as printed under the bars and as a person types it.
    private static func parenthesized(_ text: String) -> [String: String]? {
        var fields: [String: String] = [:]
        for part in text.split(separator: "(") {
            let pieces = part.split(separator: ")", maxSplits: 1)
            guard pieces.count == 2 else { return nil }
            fields[String(pieces[0])] = pieces[1].filter { !$0.isWhitespace }
        }
        return fields
    }

    private static func grams(_ fields: [String: String]) -> Double? {
        for (ai, value) in fields where ai.count == 4 {
            guard let decimals = Int(ai.suffix(1)), let raw = Double(value) else { continue }
            let amount = raw / pow(10, Double(decimals))
            if ai.hasPrefix("310") { return amount * 1000 }
            if ai.hasPrefix("320") { return amount * SizeUnit.lb.size }
        }
        return nil
    }
}

extension ScannedBarcode {
    /// The food at the package's weight when the barcode carries one and the food can be weighed, else its default.
    func portion(of food: Food) -> FoodPortion {
        guard let grams, food.nutrition.baseGrams != nil,
              let measure = food.nutrition.allMeasures.first(where: { $0.name == SizeUnit.g.rawValue }) else { return FoodPortion(food.snapshot) }
        return FoodPortion(food.snapshot, serving: Serving(measure: measure, quantity: grams.rounded()))
    }
}
