#if DEBUG
import GRDB
import UIKit

/// The dev seed's (`DevSeed`) supplements: a stack being taken at different times and days, one still to start, and
/// two stopped, so the Food Log's row, the library's sections, and a page's history all have something to show.
/// Pictures are drawn here; one has none, for the letter placeholder.
enum SupplementSeed {
    private static func component(_ name: String, _ amount: Double? = nil, _ unit: String? = nil) -> Supplement.Component {
        Supplement.Component(name: name, amount: amount, unit: unit)
    }

    private static func regimen(
        from start: Int, to end: Int? = nil, count: Double = 1, _ timing: SupplementRegimen.Timing? = nil, weekdays: [Int] = [], today: CalendarDay
    ) -> SupplementRegimen {
        SupplementRegimen(start: today.adding(days: start), end: end.map { today.adding(days: $0) }, count: count, timing: timing, weekdays: weekdays)
    }

    static func insert(in db: Database, today: CalendarDay = .today) throws {
        let rows: [(key: String, name: String, brand: String?, serving: Supplement.Serving, color: UIColor?, components: [Supplement.Component], regimens: [SupplementRegimen], note: String)] = [
            ("d3", "Vitamin D3", "NOW Foods", .init(quantity: 1, unit: "softgel"), .systemYellow, [component("Vitamin D3", 125, "mcg")],
             [regimen(from: -120, .morning, today: today)], "5,000 IU. Retest levels in March."),
            ("omega", "Omega-3 Fish Oil", "Nordic Naturals", .init(quantity: 2, unit: "softgels"), .systemOrange,
             [component("EPA", 650, "mg"), component("DHA", 450, "mg"), component("Other Omega-3s", 180, "mg")],
             [regimen(from: -90, .morning, today: today)], ""),
            ("multi", "Essential Multivitamin", "Ritual", .init(quantity: 2, unit: "capsules"), .systemTeal,
             [
                 component("Vitamin D3", 50, "mcg"), component("Vitamin E", 6.7, "mg"), component("Folate", 1000, "mcg DFE"),
                 component("Vitamin B12", 8, "mcg"), component("Iron", 8, "mg"), component("Magnesium", 30, "mg"),
                 component("Boron", 0.7, "mg"), component("Omega-3 DHA", 330, "mg"), component("Vitamin K2", 90, "mcg"),
             ],
             [regimen(from: -45, .morning, today: today)], ""),
            ("creatine", "Creatine Monohydrate", "Optimum Nutrition", .init(quantity: 1, unit: "scoop"), nil,
             [component("Creatine Monohydrate", 5, "g")], [regimen(from: -200, today: today)], "In the post-workout shake."),
            ("magnesium", "Magnesium Glycinate", "Thorne", .init(quantity: 1, unit: "capsule"), .systemIndigo,
             [component("Magnesium", 100, "mg")], [regimen(from: -60, count: 2, .evening, today: today)], ""),
            ("zinc", "Zinc Picolinate", "Thorne", .init(quantity: 1, unit: "capsule"), .systemGray,
             [component("Zinc", 30, "mg")], [regimen(from: -30, .evening, weekdays: [1, 3, 5], today: today)], ""),
            ("melatonin", "Melatonin", "Life Extension", .init(quantity: 1, unit: "tablet"), .systemPurple,
             [component("Melatonin", 0.3, "mg")], [regimen(from: 3, to: 12, .evening, today: today)], "For the trip."),
            ("ashwagandha", "Ashwagandha KSM-66", "Nootropics Depot", .init(quantity: 1, unit: "capsule"), .systemBrown,
             [component("Ashwagandha Root Extract", 600, "mg"), component("Withanolides")],
             [regimen(from: -150, to: -40, .evening, today: today)], ""),
            ("vitamin-c", "Vitamin C", "Nature Made", .init(quantity: 1, unit: "tablet"), .systemRed,
             [component("Vitamin C", 500, "mg")],
             [regimen(from: -300, to: -240, today: today), regimen(from: -100, to: -70, count: 2, today: today)], ""),
        ]
        for (index, row) in rows.enumerated() {
            var supplement = Supplement(name: row.name)
            supplement.id = DevSeed.id("supplement/\(row.key)")
            supplement.brand = row.brand
            supplement.serving = row.serving
            supplement.components = row.components
            supplement.regimens = row.regimens
            supplement.note = row.note
            supplement.createdAt = .now.addingTimeInterval(-Double(rows.count - index) * 86400)
            let picture = row.color.flatMap { picture($0, letter: String(row.name.prefix(1))) }
            try LocalStore.save(supplement, picture: picture.map { .replace($0) } ?? .keep, in: db)
        }
    }

    /// A capsule in the supplement's color on a dark square, with its first letter.
    private static func picture(_ color: UIColor, letter: String) -> Data? {
        let size = CGSize(width: 480, height: 480)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).jpegData(withCompressionQuality: 0.8) { context in
            UIColor.black.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            color.withAlphaComponent(0.3).setFill()
            context.fill(CGRect(origin: .zero, size: size))
            let cg = context.cgContext
            cg.translateBy(x: size.width / 2, y: size.height / 2)
            cg.rotate(by: -.pi / 5)
            let capsule = CGRect(x: -170, y: -70, width: 340, height: 140)
            color.setFill()
            UIBezierPath(roundedRect: capsule, cornerRadius: 70).fill()
            UIColor.white.withAlphaComponent(0.9).setFill()
            cg.saveGState()
            cg.clip(to: CGRect(x: 0, y: -70, width: 170, height: 140))
            UIBezierPath(roundedRect: capsule, cornerRadius: 70).fill()
            cg.restoreGState()
            let text = NSAttributedString(string: letter, attributes: [.font: UIFont.systemFont(ofSize: 72, weight: .heavy), .foregroundColor: UIColor.white])
            let bounds = text.size()
            text.draw(at: CGPoint(x: -85 - bounds.width / 2, y: -bounds.height / 2))
        }
    }
}
#endif
