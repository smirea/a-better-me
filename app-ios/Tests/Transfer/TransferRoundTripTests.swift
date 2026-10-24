import Foundation
import Testing
@testable import App

/// Every committed MF export imports, exports, and imports again to the same model, and our export of it lays out the
/// same cells, styles, and merges as MF's file.
@MainActor
struct TransferRoundTripTests {
    static let catalog = ExerciseCatalog().all
    static let gyms = [MFExports.gym]
    /// Re-exports land here for `tools/xlsx.py` to diff against the originals.
    static let outputDirectory = FileManager.default.temporaryDirectory.appending(path: "mf-roundtrip")

    @Test func everyCommittedExportIsCovered() {
        #expect(MFExports.programs.count == 24)
        #expect(MFExports.workouts.count == 2)
    }

    @Test(arguments: MFExports.programs)
    func programRoundTrips(_ file: String) throws {
        let original = try MFExports.data(file)
        let first = try MFTransfer.importProgram(original, exercises: Self.catalog, gyms: Self.gyms)
        #expect(first.newExercises.isEmpty, "every name in \(file) is a catalog name")
        #expect(!first.value.templates.isEmpty)
        #expect(first.value.templates.allSatisfy { !$0.blocks.isEmpty && $0.gymID == MFExports.gym.id })

        let exported = try MFTransfer.export(first.value.program, templates: first.value.templates, exercises: Self.catalog, gyms: Self.gyms)
        try save(exported, as: file)
        let second = try MFTransfer.importProgram(exported, exercises: Self.catalog, gyms: Self.gyms)
        #expect(second.newExercises.isEmpty)
        #expect(Normalized.program(second.value) == Normalized.program(first.value))

        try expectSameLayout(original: original, exported: exported, file: file) { rows in
            // "Rocket" is not one of our icons, so it imports as the default and exports as its title.
            rows[0][4] = Cell.text("Icon: Dumbbell", .header)
        }
    }

    @Test(arguments: MFExports.workouts)
    func workoutRoundTrips(_ file: String) throws {
        let original = try MFExports.data(file)
        let first = try MFTransfer.importWorkout(original, exercises: Self.catalog, gyms: Self.gyms)
        #expect(first.newExercises.isEmpty)
        #expect(first.value.exercises.count == 3)

        let exported = try MFTransfer.export(first.value, exercises: Self.catalog, gyms: Self.gyms)
        try save(exported, as: file)
        let second = try MFTransfer.importWorkout(exported, exercises: Self.catalog, gyms: Self.gyms)
        #expect(second.newExercises.isEmpty)
        #expect(Normalized.template(second.value) == Normalized.template(first.value))

        try expectSameLayout(original: original, exported: exported, file: file) { _ in }
    }

    private func expectSameLayout(original: Data, exported: Data, file: String, adjust: (inout [[Cell]]) -> Void) throws {
        let mf = try #require(try XLSX.worksheets(in: original).first)
        let ours = try XLSX.worksheets(in: exported)
        #expect(ours.count == 1)
        let sheet = try #require(ours.first)
        var expected = mf.rows
        adjust(&expected)
        #expect(sheet.name == mf.name)
        #expect(sheet.rows.count == expected.count, "\(file): row count")
        for (index, (row, mfRow)) in zip(sheet.rows, expected).enumerated() where row != mfRow {
            Issue.record("\(file) row \(index + 1): ours \(row) MF \(mfRow)")
        }
        #expect(sheet.mergedRows == mf.mergedRows, "\(file): merged day cells")
        #expect(sheet.columnWidths.keys.sorted() == Array(1...sheet.rows[0].count))
    }

    private func save(_ data: Data, as file: String) throws {
        try FileManager.default.createDirectory(at: Self.outputDirectory, withIntermediateDirectories: true)
        let url = Self.outputDirectory.appending(path: file)
        try data.write(to: url)
        print("EXPORT|\(url.path)")
    }
}
