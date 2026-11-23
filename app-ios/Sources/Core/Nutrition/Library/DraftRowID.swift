import Foundation

extension UUID {
    /// The id of row `index` in a draft built from a stored record. It is the same every time the record opens, so a
    /// persisted draft can be checked against a fresh one (`persistDraft`); rows added in the form keep random ids.
    init(draftRow index: Int) {
        self.init(uuidString: String(format: "00000000-0000-4000-8000-%012x", index))!
    }
}
