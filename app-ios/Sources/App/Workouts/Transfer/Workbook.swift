import Foundation

/// One spreadsheet as MF writes it: rows of cells from column A, the column widths, and the merged day-name cells.
struct Worksheet: Hashable {
    var name: String
    var rows: [[Cell]]
    /// One-based column number to width, as in `<col min="n" max="n" width=…>`.
    var columnWidths: [Int: Double] = [:]
    /// Ranges in column A that MF merges over a day's exercise rows, such as rows 2...4.
    var mergedRows: [ClosedRange<Int>] = []
}

struct Cell: Hashable {
    var value: CellValue?
    var style = CellStyle.plain

    static let empty = Cell()
    static func text(_ text: String, _ style: CellStyle = .plain) -> Cell { Cell(value: .text(text), style: style) }
    static func number(_ number: Double, _ style: CellStyle = .plain) -> Cell { Cell(value: .number(number), style: style) }
}

enum CellValue: Hashable {
    case text(String)
    case number(Double)
}

/// The `cellXfs` indices of MF's fixed `styles.xml`: 2 is the bold header row, 3 the top-left wrapped day name.
enum CellStyle: Int, Hashable {
    case plain = 0
    case header = 2
    case dayName = 3
}

enum TransferError: Error, Hashable {
    case notAnXLSX
    case missingSheet(String)
    /// A row the format does not allow, with its one-based row number for the alert.
    case malformedRow(Int, String)
    /// A workout file given to the program importer or the other way around.
    case wrongKind(expected: TransferKind)
}

enum TransferKind: Hashable {
    case workout, program
}
