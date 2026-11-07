import Foundation
import GRDB
import Testing
@testable import App

@MainActor
struct ProgramSeedTests {
    @Test func seededProgramDaysOpenTheProgramsOwnTemplates() async throws {
        let store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "seed-\(UUID().uuidString)/a.sqlite"))
        try await store.write { try DevSeed.seed(in: $0) }.value
        let (program, templates, library) = try store.readBlocking { db in
            try (Program.all.fetch(db).first { $0.isActive }, WorkoutTemplate.all.fetch(db), WorkoutTemplate.library.fetch(db))
        }
        let active = try #require(program)
        let owned = Dictionary(uniqueKeysWithValues: templates.filter { $0.programID == active.id }.map { ($0.id, $0.name) })
        #expect(active.days.map { $0.templateID.flatMap { owned[$0] } ?? "Rest" } == ["Upper", "Lower", "Rest", "Upper"])
        #expect(library.map(\.name) == ["Upper", "Lower"])
    }

    @Test func seedsAnInactiveProgramForTheWorkoutLibrary() async throws {
        let store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "seed-\(UUID().uuidString)/a.sqlite"))
        try await store.write { try DevSeed.seed(in: $0) }.value
        let (programs, templates) = try store.readBlocking { db in try (Program.all.fetch(db), WorkoutTemplate.all.fetch(db)) }
        let inactive = try #require(programs.first { !$0.isActive })
        let owned = Dictionary(uniqueKeysWithValues: templates.filter { $0.programID == inactive.id }.map { ($0.id, $0.name) })
        #expect(programs.filter(\.isActive).count == 1)
        #expect(inactive.name == "Upper Lower Lite")
        #expect(inactive.days.map { $0.templateID.flatMap { owned[$0] } ?? "Rest" } == ["Upper", "Rest", "Lower"])
    }
}
