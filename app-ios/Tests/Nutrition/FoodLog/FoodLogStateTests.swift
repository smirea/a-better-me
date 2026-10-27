import Foundation
import Testing
@testable import App

/// Select mode's hour pills, copy and move with Undo, and Explode, against a real store.
@MainActor
struct FoodLogStateTests {
    let monday = calendarDay("2025-03-03")
    let store: LocalStore

    init() throws {
        store = try LocalStore(unsyncedAt: FileManager.default.temporaryDirectory.appending(path: "foodlog-\(UUID().uuidString)/a.sqlite"))
    }

    func entry(minute: Int, quantity: Double = 1) -> FoodEntry {
        FoodEntry(FoodPortion(yogurt, serving: Serving(measure: yogurt.nutrition.measures[0], quantity: quantity)), day: monday, minute: minute)
    }

    func entries(on day: CalendarDay) async throws -> [FoodEntry] {
        try await store.write { _ in }.value
        return try store.read(FoodEntry.on(day).fetch)
    }

    func log(_ entries: [FoodEntry]) async throws {
        try await store.write { db in
            for entry in entries {
                try entry.insert(db)
            }
        }.value
    }

    @Test func tappingAnHourPillSelectsTheHourThenTogglesIt() {
        let state = FoodLogState()
        let breakfast = [UUID(), UUID()]
        let lunch = UUID()

        state.selectHour([])
        #expect(!state.selecting)

        state.selectHour(breakfast)
        #expect(state.selecting)
        #expect(state.selection == Set(breakfast))

        state.select(lunch)
        state.selectHour(breakfast)
        #expect(state.selection == [lunch])

        state.selectHour(breakfast)
        #expect(state.selection == Set(breakfast + [lunch]))
    }

    @Test func aCopyToAnHourConfirmsAndUndoRemovesOnlyTheCopies() async throws {
        let breakfast = [entry(minute: 482), entry(minute: 485, quantity: 2)]
        try await log(breakfast)
        let state = FoodLogState()
        state.selectHour(breakfast.map(\.id))
        state.pending = .init(action: .copy, entries: breakfast)

        state.paste(to: .hour(monday, hour: 16), in: store)
        #expect(!state.selecting)
        #expect(state.pending == nil)
        #expect(state.notice?.message == "Copied 2 foods to Mon, Mar 3 at 4 PM")
        #expect(try await entries(on: monday).map(\.minute) == [482, 485, 960, 960])
        #expect(try await entries(on: monday).map(\.serving.quantity) == [1, 2, 1, 2])

        state.undo(in: store)
        #expect(state.notice == nil)
        #expect(try await entries(on: monday).map(\.id) == breakfast.map(\.id))
    }

    @Test func undoingAMovePutsEachEntryBackAtItsOwnTime() async throws {
        let breakfast = [entry(minute: 482), entry(minute: 485)]
        try await log(breakfast)
        let state = FoodLogState()

        state.relocate(breakfast, .move, to: .dateTime(monday.adding(days: 1), minute: 1080), in: store)
        #expect(try await entries(on: monday).isEmpty)
        #expect(try await entries(on: monday.adding(days: 1)).map(\.minute) == [1080, 1080])

        state.undo(in: store)
        #expect(try await entries(on: monday).map(\.minute) == [482, 485])
        #expect(try await entries(on: monday.adding(days: 1)).isEmpty)
    }

    @Test func undoingAMoveLeavesAnEntryRetimedSinceAlone() async throws {
        let breakfast = [entry(minute: 482), entry(minute: 485)]
        try await log(breakfast)
        let state = FoodLogState()

        state.relocate(breakfast, .move, to: .hour(monday, hour: 12), in: store)
        store.moveEntries([breakfast[1].id], to: monday, minute: 780)
        state.undo(in: store)
        #expect(try await entries(on: monday).map(\.minute) == [482, 780])
    }

    @Test func undoingAMoveRestoresTheTimeTheMoveReplacedNotTheSelectedOne() async throws {
        let snack = entry(minute: 600)
        try await log([snack])
        store.moveEntries([snack.id], to: monday, minute: 630)
        let state = FoodLogState()

        state.relocate([snack], .move, to: .hour(monday, hour: 15), in: store)
        #expect(try await entries(on: monday).map(\.minute) == [900])
        state.undo(in: store)
        #expect(try await entries(on: monday).map(\.minute) == [630])
    }

    @Test func aCopyOfAnEntryDeletedBeforeTheWriteIsSkipped() async throws {
        let breakfast = [entry(minute: 482), entry(minute: 485)]
        try await log(breakfast)
        store.deleteEntries([breakfast[0].id])

        let undo = store.relocate(breakfast, .copy, to: .hour(monday, hour: 12))
        #expect(try await entries(on: monday).map(\.minute) == [485, 720])
        store.undo(undo)
        #expect(try await entries(on: monday).map(\.id) == [breakfast[1].id])
    }

    @Test func explodeReplacesALoggedRecipeWithItsIngredientsAtTheSameTime() async throws {
        var recipe = Recipe(name: "Parfait", servings: 2)
        recipe.ingredients = [RecipeIngredient(FoodPortion(yogurt, serving: Serving(measure: yogurt.nutrition.measures[0], quantity: 4)))]
        let half = FoodEntry(FoodPortion(recipe.snapshot, serving: Serving(measure: recipe.nutrition.measures[0], quantity: 0.5)), day: monday, minute: 615)
        let orphan = FoodEntry(
            FoodPortion(FoodSnapshot(foodID: UUID().uuidString.lowercased(), source: .recipe, name: "Gone", nutrition: recipe.nutrition)),
            day: monday, minute: 700
        )
        try await store.write { [recipe] db in try recipe.insert(db) }.value
        try await log([half, orphan])

        #expect(try await store.explode(half.id).value)
        #expect(try await store.explode(orphan.id).value == false)
        let exploded = try await entries(on: monday)
        #expect(exploded.map(\.food.name) == ["Yogurt", "Gone"])
        #expect(exploded.map(\.minute) == [615, 700])
        #expect(exploded.first?.serving.quantity == 1)
    }
}
