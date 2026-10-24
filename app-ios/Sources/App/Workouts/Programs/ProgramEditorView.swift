import SwiftUI

/// Actions the New Program wizard pins under a program it has just generated or started from scratch and not yet kept.
struct ProgramDraftActions {
    var save: () -> Void
    var activate: () -> Void
}

/// The program editor (research spec §3.3 and milestone-2.md §2). Placeholder until the editor lands: callers build
/// against this signature.
struct ProgramEditorView: View {
    let programID: Program.ID
    var initialDayID: ProgramDay.ID? = nil
    var draft: ProgramDraftActions? = nil

    var body: some View {
        ContentUnavailableView("Program editor", systemImage: "hammer")
    }
}
