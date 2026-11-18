#if DEBUG
import GRDB
import UIKit

/// The dev seed's (`DevSeed`) supplements: a stack being taken at different times and days, one still to start, two
/// stopped, one of them eight times over, and one never taken, so the Food Log's row, the library's sections and
/// ranges, and a page's truncated history all have something to show.
/// Pictures are drawn here: one has none, for the letter placeholder, and the multivitamin has a second, its label.
/// Two tags and a few product pages cover the rest of a page.
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
             // Taken for three weeks out of every six, so its History is long enough to truncate.
             (0..<8).reversed().map { regimen(from: -70 - $0 * 42, to: -50 - $0 * 42, count: $0 % 2 == 0 ? 2 : 1, today: today) }, "Only through cold season."),
            ("probiotic", "Acidophilus Probiotic", "Nature's Bounty", .init(quantity: 1, unit: "capsule"), .systemGreen,
             [component("Lactobacillus acidophilus", 100, "million CFU")], [], "Bought, never started."),
        ]
        var morning = Tag(name: "Morning Stack", color: "#096dd9")
        morning.id = DevSeed.id("tag/morning")
        var sleep = Tag(name: "Sleep", color: "#722ed1")
        sleep.id = DevSeed.id("tag/sleep")
        sleep.note = "Wind-down protocol since the spring."
        try LocalStore.put(morning, in: db)
        try LocalStore.put(sleep, in: db)
        let tags = ["d3": [morning.id], "omega": [morning.id], "multi": [morning.id], "magnesium": [sleep.id], "melatonin": [sleep.id]]
        let urls = ["d3": "https://www.nowfoods.com/products/supplements/vitamin-d-3-5000-iu-softgels", "multi": "https://ritual.com/products/essential-for-men-multivitamin-18"]
        for (index, row) in rows.enumerated() {
            var supplement = Supplement(name: row.name)
            supplement.id = DevSeed.id("supplement/\(row.key)")
            supplement.url = urls[row.key]
            supplement.tags = tags[row.key] ?? []
            supplement.brand = row.brand
            supplement.serving = row.serving
            supplement.components = row.components
            supplement.regimens = row.regimens
            supplement.note = row.note
            supplement.createdAt = .now.addingTimeInterval(-Double(rows.count - index) * 86400)
            var pictures = [row.color.flatMap { picture($0, letter: String(row.name.prefix(1))) }]
            if row.key == "multi" { pictures.append(label(row.name, serving: SupplementFormat.amount(row.serving), components: row.components)) }
            let images = pictures.enumerated().compactMap { number, jpeg in
                jpeg.map { SupplementImage(id: DevSeed.id("supplement/\(row.key)/picture/\(number)"), jpeg: $0) }
            }
            supplement.images = images.map(\.id)
            try LocalStore.save(supplement, adding: images, in: db)
        }
    }

    /// A Supplement Facts panel, tall and narrow as a photographed one is.
    private static func label(_ name: String, serving: String, components: [Supplement.Component]) -> Data? {
        let size = CGSize(width: 420, height: 150 + CGFloat(components.count) * 44)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).jpegData(withCompressionQuality: 0.8) { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            func draw(_ text: String, at point: CGPoint, size: CGFloat, weight: UIFont.Weight = .regular) {
                NSAttributedString(string: text, attributes: [.font: UIFont.systemFont(ofSize: size, weight: weight), .foregroundColor: UIColor.black]).draw(at: point)
            }
            draw("Supplement Facts", at: CGPoint(x: 20, y: 16), size: 34, weight: .black)
            draw("\(name) · Serving Size \(serving)", at: CGPoint(x: 20, y: 66), size: 15)
            UIColor.black.setFill()
            context.fill(CGRect(x: 20, y: 98, width: size.width - 40, height: 8))
            for (index, component) in components.enumerated() {
                let y = 120 + CGFloat(index) * 44
                draw(component.name, at: CGPoint(x: 20, y: y), size: 18, weight: .semibold)
                let amount = SupplementFormat.component(component) ?? ""
                let width = (amount as NSString).size(withAttributes: [.font: UIFont.systemFont(ofSize: 18)]).width
                draw(amount, at: CGPoint(x: size.width - 20 - width, y: y), size: 18)
                context.fill(CGRect(x: 20, y: y + 32, width: size.width - 40, height: 1))
            }
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
