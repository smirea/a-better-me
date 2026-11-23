import Foundation

/// What package photos say about one supplement (`server/src/food/supplementLabel.ts`). A field no photo shows is nil.
struct SupplementLabel: Codable, Hashable, Sendable {
    var name: String?
    var brand: String?
    var serving: Supplement.Serving?
    var components: [Supplement.Component]?
}

/// `POST /api/food-database/supplement-label`.
typealias SupplementLabelClient = LabelClient<SupplementLabel>

extension LabelClient where Label == SupplementLabel {
    static var live: SupplementLabelClient {
        SupplementLabelClient(endpoint: AppEnvironment.apiURL.appending(path: "api/food-database/supplement-label"), token: AppEnvironment.ownerToken)
    }
}

typealias SupplementPhotoReader = PhotoReader<SupplementLabel>

extension PhotoReader where Label == SupplementLabel {
    convenience init(client: SupplementLabelClient = .live) {
        self.init { try await client.read(jpegs: $0) }
    }
}

/// The supplement editor's fields as typed, so the form binds text and validation and conversion stay testable.
struct SupplementDraft: Codable, Equatable, Sendable {
    struct ComponentDraft: Codable, Equatable, Identifiable, Sendable {
        var id = UUID()
        var name = ""
        var amount = ""
        var unit = ""

        var isBlank: Bool { [name, amount, unit].allSatisfy { $0.trimmingCharacters(in: .whitespaces).isEmpty } }
    }

    struct RegimenDraft: Codable, Equatable, Sendable {
        var start: CalendarDay
        var ends = false
        var end: CalendarDay
        var count = "1"
        var timing: SupplementRegimen.Timing?
        /// Every day while all seven are on, which is how it is stored (`SupplementRegimen.weekdays` empty).
        var weekdays = Set(1...7)
        /// The regimen's tags, which the form does not edit and a save keeps.
        var tags: [UUID]?
        var pauses: [SupplementRegimen.Pause] = []

        init(start: CalendarDay) {
            self.start = start
            end = start
        }

        init(_ regimen: SupplementRegimen) {
            start = regimen.start
            ends = regimen.end != nil
            end = regimen.end ?? regimen.start
            count = NumberText.plain(regimen.count)
            timing = regimen.timing
            weekdays = regimen.weekdays.isEmpty ? Set(1...7) : Set(regimen.weekdays)
            tags = regimen.tags
            pauses = regimen.pauses ?? []
        }

        /// The pause that has `today` off, not one still to come.
        func pause(on today: CalendarDay) -> SupplementRegimen.Pause? {
            pauses.current(on: today).flatMap { $0.start <= today ? $0 : nil }
        }
    }

    enum Field: Hashable, Sendable {
        case name, brand, url, servingQuantity, servingUnit, count, weekdays, end, note
        case componentName(UUID), componentAmount(UUID), componentUnit(UUID)
    }

    var name = ""
    var brand = ""
    var url = ""
    var servingQuantity = "1"
    var servingUnit = "capsule"
    var components: [ComponentDraft] = []
    /// False stops it: the regimen fields are kept only as what Start would take it again with.
    var taking = true
    var regimen: RegimenDraft
    var note = ""

    init(today: CalendarDay = .today) {
        regimen = RegimenDraft(start: today)
    }

    /// A stopped supplement opens with its last regimen's amount and days, starting `today`, not taking.
    init(_ supplement: Supplement, today: CalendarDay = .today) {
        name = supplement.name
        brand = supplement.brand ?? ""
        url = supplement.url ?? ""
        servingQuantity = NumberText.plain(supplement.serving.quantity)
        servingUnit = supplement.serving.unit
        components = supplement.components.map {
            ComponentDraft(name: $0.name, amount: $0.amount.map(NumberText.text) ?? "", unit: $0.unit ?? "")
        }
        note = supplement.note
        if let index = supplement.currentRegimen(on: today) {
            regimen = RegimenDraft(supplement.regimens[index])
        } else {
            taking = false
            var restart = supplement.regimens.last.map(RegimenDraft.init) ?? RegimenDraft(start: today)
            restart.start = today
            restart.ends = false
            restart.end = today
            restart.tags = nil
            restart.pauses = []
            regimen = restart
        }
    }

    var issues: [Field: String] {
        var issues: [Field: String] = [:]
        if name.trimmingCharacters(in: .whitespaces).isEmpty { issues[.name] = "Name the supplement" }
        if !url.trimmingCharacters(in: .whitespaces).isEmpty, Self.link(url) == nil { issues[.url] = "Enter a web address" }
        if NumberText.parse(servingQuantity).map({ $0 > 0 }) != true { issues[.servingQuantity] = "Enter how many make a serving" }
        if servingUnit.trimmingCharacters(in: .whitespaces).isEmpty { issues[.servingUnit] = "Enter what a serving is counted in" }
        for component in components where !component.isBlank {
            if component.name.trimmingCharacters(in: .whitespaces).isEmpty { issues[.componentName(component.id)] = "Name the ingredient" }
            let amount = component.amount.trimmingCharacters(in: .whitespaces)
            if !amount.isEmpty, NumberText.parse(amount).map({ $0 >= 0 }) != true { issues[.componentAmount(component.id)] = "Enter the amount as a number" }
        }
        if taking {
            if NumberText.parse(regimen.count).map({ $0 > 0 }) != true { issues[.count] = "Enter how many servings a day" }
            if regimen.weekdays.isEmpty { issues[.weekdays] = "Pick at least one day" }
            if regimen.ends, regimen.end < regimen.start { issues[.end] = "The end is before the start" }
        }
        return issues
    }

    /// The supplement these fields describe, or nil while a field is wrong. Editing keeps `editing`'s id, pictures, tags,
    /// and past regimens: taking replaces the regimen that is running or still to start, or adds one, and not taking stops it.
    func supplement(editing: Supplement? = nil, today: CalendarDay = .today) -> Supplement? {
        guard issues.isEmpty, let quantity = NumberText.parse(servingQuantity) else { return nil }
        let name = name.trimmingCharacters(in: .whitespaces)
        var supplement = editing ?? Supplement(name: name)
        supplement.name = name
        supplement.brand = Self.text(brand)
        supplement.url = Self.link(url)?.absoluteString
        supplement.serving = Supplement.Serving(quantity: quantity, unit: servingUnit.trimmingCharacters(in: .whitespaces))
        supplement.components = components.filter { !$0.isBlank }.map {
            Supplement.Component(name: $0.name.trimmingCharacters(in: .whitespaces), amount: NumberText.parse($0.amount), unit: Self.text($0.unit))
        }
        supplement.note = note.trimmingCharacters(in: .whitespacesAndNewlines)
        if taking, let count = NumberText.parse(regimen.count) {
            let saved = SupplementRegimen(
                start: regimen.start, end: regimen.ends ? regimen.end : nil, count: count, timing: regimen.timing,
                weekdays: regimen.weekdays.count == 7 ? [] : regimen.weekdays.sorted(), tags: regimen.tags,
                pauses: regimen.pauses.isEmpty ? nil : regimen.pauses
            )
            if let index = supplement.currentRegimen(on: today) {
                supplement.regimens[index] = saved
            } else {
                supplement.regimens.append(saved)
            }
            supplement.regimens.sort { $0.start < $1.start }
        } else {
            supplement.stop(on: today)
        }
        return supplement
    }

    /// A typed web address as a link, `https` when it names no scheme. Nil when it is not one.
    private static func link(_ value: String) -> URL? {
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, !trimmed.contains(" "),
              let url = URL(string: trimmed.contains("://") ? trimmed : "https://\(trimmed)"),
              ["http", "https"].contains(url.scheme?.lowercased()), url.host()?.contains(".") == true else { return nil }
        return url
    }

    private static func text(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? nil : trimmed
    }

    var focusOrder: FocusOrder<Field> {
        FocusOrder(
            [.name, .brand, .url, .servingQuantity, .servingUnit]
                + components.flatMap { [.componentName($0.id), .componentAmount($0.id), .componentUnit($0.id)] }
                + (taking ? [.count] : []) + [.note]
        )
    }
}

extension SupplementDraft {
    /// This draft with what the label found written over it.
    func reading(_ label: SupplementLabel) -> SupplementDraft {
        var read = self
        if let name = label.name { read.name = name }
        if let brand = label.brand { read.brand = brand }
        if let serving = label.serving {
            read.servingQuantity = NumberText.plain(serving.quantity)
            read.servingUnit = serving.unit
        }
        if let components = label.components {
            read.components = components.map { ComponentDraft(name: $0.name, amount: $0.amount.map(NumberText.text) ?? "", unit: $0.unit ?? "") }
        }
        return read
    }

    /// Takes a new read of the photos, except where the owner changed a field since `baseline`, the draft as the last
    /// read (or the editor's opening) left it. The serving moves as one, and so does the ingredient list: a row fixed
    /// by hand keeps the whole list, since a second read has no way to say which of its rows that one is.
    mutating func merge(_ read: SupplementDraft, over baseline: SupplementDraft) {
        if name == baseline.name { name = read.name }
        if brand == baseline.brand { brand = read.brand }
        if servingQuantity == baseline.servingQuantity, servingUnit == baseline.servingUnit {
            servingQuantity = read.servingQuantity
            servingUnit = read.servingUnit
        }
        if components == baseline.components { components = read.components }
    }
}
