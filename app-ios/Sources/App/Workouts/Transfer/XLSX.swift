import Foundation

/// A minimal SpreadsheetML reader and writer. The writer emits MF's own parts byte for byte where they are fixed
/// (content types, relationships, `styles.xml`, `app.xml` naming "Essential XlsIO") and its cell encoding: shared strings
/// for text, `t="n"` with a decimal such as `2.0` for numbers, and an explicit empty `<c>` for every blank cell.
enum XLSX {
    /// Every sheet in workbook order. Reads shared strings, inline strings, and numbers, so a file re-saved by Excel or
    /// Numbers still opens. Styles read back as MF's indices; any other index reads as plain.
    static func worksheets(in data: Data) throws -> [Worksheet] {
        let parts = try Zip.entries(of: data)
        guard let workbook = parts["xl/workbook.xml"].flatMap(ParsedXML.parse),
              let relationships = parts["xl/_rels/workbook.xml.rels"].flatMap(ParsedXML.parse)
        else { throw TransferError.notAnXLSX }
        let targets = Dictionary(relationships.all("Relationship").map { ($0["Id"] ?? "", $0["Target"] ?? "") }) { first, _ in first }
        let shared = parts["xl/sharedStrings.xml"].flatMap(ParsedXML.parse)?.all("si").map(\.text) ?? []
        return try workbook.all("sheet").map { sheet in
            guard let target = sheet["id"].flatMap({ targets[$0] }) else { throw TransferError.notAnXLSX }
            let path = target.hasPrefix("/") ? String(target.dropFirst()) : "xl/" + target
            guard let root = parts[path].flatMap(ParsedXML.parse) else { throw TransferError.notAnXLSX }
            return worksheet(named: sheet["name"] ?? "", root: root, shared: shared)
        }
    }

    static func data(of sheet: Worksheet, created: Date) throws -> Data {
        var strings = SharedStrings()
        let sheetXML = worksheetXML(sheet, strings: &strings)
        let timestamp = DateFormatter.posix("yyyy-MM-dd'T'HH:mm:ss.SSSSSS").string(from: created)
        let core = #"<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dcterms:created xsi:type="dcterms:W3CDTF">\#(timestamp)</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">\#(timestamp)</dcterms:modified></cp:coreProperties>"#
        let workbook = #"<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr codeName="ThisWorkbook" defaultThemeVersion="153222"/><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="\#(escape(sheet.name))" sheetId="1" r:id="rId1"/></sheets></workbook>"#
        let parts: [(path: String, text: String)] = [
            ("xl/workbook.xml", workbook),
            ("xl/worksheets/_rels/sheet1.xml.rels", Fixed.sheetRelationships),
            ("xl/worksheets/sheet1.xml", sheetXML),
            ("xl/sharedStrings.xml", strings.xml),
            ("xl/styles.xml", Fixed.styles),
            ("docProps/app.xml", Fixed.app),
            ("docProps/core.xml", core),
            ("[Content_Types].xml", Fixed.contentTypes),
            ("_rels/.rels", Fixed.packageRelationships),
            ("xl/_rels/workbook.xml.rels", Fixed.workbookRelationships),
        ]
        return try Zip.archive(parts.map { ($0.path, Data($0.text.utf8)) }, modified: created)
    }

    private static func worksheet(named name: String, root: ParsedXML, shared: [String]) -> Worksheet {
        var rows: [[Cell]] = []
        for (position, row) in root.all("row").enumerated() {
            let number = row["r"].flatMap(Int.init) ?? position + 1
            var cells: [Cell] = []
            for (index, cell) in row.children.filter({ $0.name == "c" }).enumerated() {
                let column = cell["r"].map(columnIndex) ?? index
                while cells.count < column { cells.append(.empty) }
                let style = cell["s"].flatMap(Int.init).flatMap(CellStyle.init(rawValue:)) ?? .plain
                let raw = cell.first("v")?.characters
                let value: CellValue? = switch cell["t"] {
                case "s": raw.flatMap(Int.init).flatMap { shared.indices.contains($0) ? .text(shared[$0]) : nil }
                case "inlineStr": cell.first("is").map { .text($0.text) }
                case "str": raw.map { .text($0) }
                default: raw.flatMap(Double.init).map { .number($0) }
                }
                let entry = Cell(value: value, style: style)
                if column < cells.count { cells[column] = entry } else { cells.append(entry) }
            }
            while rows.count < number - 1 { rows.append([]) }
            rows.append(cells)
        }
        var widths: [Int: Double] = [:]
        for column in root.all("col") {
            guard let min = column["min"].flatMap(Int.init), let width = column["width"].flatMap(Double.init) else { continue }
            for index in min...max(min, column["max"].flatMap(Int.init) ?? min) { widths[index] = width }
        }
        let merged = root.all("mergeCell").compactMap { merge -> ClosedRange<Int>? in
            let ends = (merge["ref"] ?? "").split(separator: ":").map(String.init)
            guard ends.count == 2, ends.allSatisfy({ $0.hasPrefix("A") && columnIndex($0) == 0 }),
                  let first = Int(ends[0].dropFirst()), let last = Int(ends[1].dropFirst()), first <= last
            else { return nil }
            return first...last
        }
        return Worksheet(name: name, rows: rows, columnWidths: widths, mergedRows: merged)
    }

    private static func worksheetXML(_ sheet: Worksheet, strings: inout SharedStrings) -> String {
        var xml = #"<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><sheetPr/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15.0"/>"#
        if !sheet.columnWidths.isEmpty {
            xml += "<cols>"
            for (column, width) in sheet.columnWidths.sorted(by: { $0.key < $1.key }) {
                xml += #"<col min="\#(column)" max="\#(column)" width="\#(width)" customWidth="1"/>"#
            }
            xml += "</cols>"
        }
        xml += "<sheetData>"
        for (index, row) in sheet.rows.enumerated() {
            xml += #"<row r="\#(index + 1)">"#
            for (column, cell) in row.enumerated() {
                let ref = columnName(column) + String(index + 1)
                let style = cell.style == .plain ? "" : #" s="\#(cell.style.rawValue)""#
                switch cell.value {
                case nil: xml += #"<c r="\#(ref)"\#(style)/>"#
                case .text(let text): xml += #"<c r="\#(ref)" t="s"\#(style)><v>\#(strings.index(of: text))</v></c>"#
                case .number(let number): xml += #"<c r="\#(ref)" t="n"\#(style)><v>\#(decimal(number))</v></c>"#
                }
            }
            xml += "</row>"
        }
        xml += "</sheetData>"
        if !sheet.mergedRows.isEmpty {
            xml += #"<mergeCells count="\#(sheet.mergedRows.count)">"#
            for range in sheet.mergedRows { xml += #"<mergeCell ref="A\#(range.lowerBound):A\#(range.upperBound)"/>"# }
            xml += "</mergeCells>"
        }
        xml += #"<pageMargins left="0.75" right="0.75" top="1.0" bottom="1.0" header="0.5" footer="0.5"/><headerFooter scaleWithDoc="1" alignWithMargins="0" differentFirst="0" differentOddEven="0"/><extLst/></worksheet>"#
        return xml
    }

    /// MF writes every number with a decimal point: `2.0`, `90.0`.
    private static func decimal(_ number: Double) -> String {
        number.rounded() == number && abs(number) < 1e15 ? "\(Int(number)).0" : "\(number)"
    }

    /// "A" is 0, "AA" is 26. Digits after the letters are ignored.
    private static func columnIndex(_ reference: String) -> Int {
        reference.prefix { $0.isLetter }.uppercased().unicodeScalars.reduce(0) { $0 * 26 + Int($1.value) - 64 } - 1
    }

    private static func columnName(_ index: Int) -> String {
        var name = ""
        var rest = index + 1
        while rest > 0 {
            let digit = (rest - 1) % 26
            name = String(UnicodeScalar(UInt8(65 + digit))) + name
            rest = (rest - 1) / 26
        }
        return name
    }

    fileprivate static func escape(_ text: String) -> String {
        var escaped = ""
        for character in text {
            switch character {
            case "&": escaped += "&amp;"
            case "<": escaped += "&lt;"
            case ">": escaped += "&gt;"
            case "\"": escaped += "&quot;"
            default: escaped.append(character)
            }
        }
        return escaped
    }
}

/// Text cells in order of first use, as MF numbers them.
private struct SharedStrings {
    private var order: [String] = []
    private var indices: [String: Int] = [:]

    mutating func index(of text: String) -> Int {
        if let index = indices[text] { return index }
        indices[text] = order.count
        order.append(text)
        return order.count - 1
    }

    var xml: String {
        let items = order.map { text in
            let space = text.first?.isWhitespace == true || text.last?.isWhitespace == true ? #" xml:space="preserve""# : ""
            return "<si><t\(space)>\(XLSX.escape(text))</t></si>"
        }
        return #"<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" uniqueCount="\#(order.count)" count="\#(order.count)">"# + items.joined() + "</sst>"
    }
}

/// The parts every MF export carries unchanged, copied from `docs/research/mf-workouts/exports/`.
private enum Fixed {
    static let contentTypes = #"<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>"#
    static let packageRelationships = #"<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>"#
    static let app = #"<?xml version="1.0"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Essential XlsIO</Application></Properties>"#
    static let workbookRelationships = #"<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>"#
    static let sheetRelationships = #"<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>"#
    static let styles = #"<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac"><fonts count="2"><font><sz val="11.0"/><color rgb="FF000000"/><name val="Calibri"/></font><font><b/><sz val="11.0"/><color rgb="FF000000"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment horizontal="general" vertical="bottom" wrapText="0"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="1"><alignment horizontal="general" vertical="bottom" wrapText="0"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="1"><alignment horizontal="general" vertical="bottom" wrapText="0"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment horizontal="left" vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="2"><cellStyle name="Normal" xfId="0" builtinId="0"/><cellStyle name="HeaderStyle" xfId="1"/></cellStyles><dxfs/></styleSheet>"#
}

/// A parsed XML element with namespace prefixes dropped from element and attribute names, so `x:row` and `r:id` read
/// as `row` and `id`.
private final class ParsedXML {
    let name: String
    let attributes: [String: String]
    var children: [ParsedXML] = []
    var characters = ""

    init(name: String, attributes: [String: String]) {
        self.name = name
        self.attributes = attributes
    }

    subscript(attribute: String) -> String? { attributes[attribute] }

    func first(_ name: String) -> ParsedXML? { children.first { $0.name == name } }

    func all(_ name: String) -> [ParsedXML] {
        var found: [ParsedXML] = []
        var stack = [self]
        while let element = stack.popLast() {
            if element.name == name { found.append(element) }
            stack.append(contentsOf: element.children.reversed())
        }
        return found
    }

    /// The text of every `<t>` below, skipping phonetic runs: a shared string's or inline string's value.
    var text: String {
        if name == "t" { return characters }
        if name == "rPh" { return "" }
        return children.map(\.text).joined()
    }

    static func parse(_ data: Data) -> ParsedXML? {
        let builder = Builder()
        let parser = XMLParser(data: data)
        parser.delegate = builder
        return parser.parse() ? builder.root : nil
    }

    private final class Builder: NSObject, XMLParserDelegate {
        var root: ParsedXML?
        private var stack: [ParsedXML] = []

        func parser(_ parser: XMLParser, didStartElement elementName: String, namespaceURI: String?, qualifiedName: String?, attributes: [String: String]) {
            let element = ParsedXML(name: Self.local(elementName), attributes: Dictionary(attributes.map { (Self.local($0.key), $0.value) }) { first, _ in first })
            stack.last?.children.append(element)
            if root == nil { root = element }
            stack.append(element)
        }

        func parser(_ parser: XMLParser, didEndElement elementName: String, namespaceURI: String?, qualifiedName: String?) {
            stack.removeLast()
        }

        func parser(_ parser: XMLParser, foundCharacters string: String) {
            stack.last?.characters += string
        }

        private static func local(_ name: String) -> String {
            name.split(separator: ":").last.map(String.init) ?? name
        }
    }
}

extension DateFormatter {
    static func posix(_ format: String) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = format
        return formatter
    }
}
