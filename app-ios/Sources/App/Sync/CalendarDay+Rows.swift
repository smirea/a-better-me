import GRDB

extension SyncedRecord where ID == CalendarDay {
    static func key(_ id: CalendarDay) -> String { id.description }
}

extension Row {
    func day(_ column: String) throws -> CalendarDay {
        let text: String = self[column]
        guard let day = CalendarDay(text) else { throw RowDecodingError(description: "\(column) is not a day: \(text)") }
        return day
    }
}
