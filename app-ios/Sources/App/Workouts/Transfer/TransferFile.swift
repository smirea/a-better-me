import SwiftUI
import UniformTypeIdentifiers

extension UTType {
    static let xlsx = UTType(filenameExtension: "xlsx")!
}

/// An MF export for `ShareLink`. The workbook is built only when the share sheet asks for the file, stamped with that
/// moment so the file name and the sheet's dates agree.
struct TransferFile: Transferable {
    let bytes: @Sendable (Date) throws -> Data

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .xlsx) { file in
            let date = Date.now
            let url = URL.temporaryDirectory.appending(path: MFFormat.fileName(at: date))
            try file.bytes(date).write(to: url, options: .atomic)
            return SentTransferredFile(url)
        }
    }

    /// The bytes of a file picked through `fileImporter`, which lives outside the sandbox.
    static func read(_ url: URL) throws -> Data {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        return try Data(contentsOf: url)
    }
}

extension Imported {
    /// Inserts the custom exercises the import created, so the imported blocks resolve before the value is shown.
    @MainActor func insertNewExercises(into store: LocalStore) {
        for exercise in newExercises { store.insert(CustomExercise(exercise)) }
    }
}

extension View {
    /// After an import, names the exercises that were added as custom exercises because no catalog entry matched.
    func unmatchedExercisesAlert(_ names: Binding<[String]>) -> some View {
        alert("Not matched to the catalog", isPresented: Binding { !names.wrappedValue.isEmpty } set: { if !$0 { names.wrappedValue = [] } }) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("These exercises were added as custom exercises:\n\(names.wrappedValue.joined(separator: "\n"))")
        }
    }
}
