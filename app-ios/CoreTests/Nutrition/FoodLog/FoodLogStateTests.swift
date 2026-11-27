import Foundation
import Testing
@testable import Core

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
        return try store.readBlocking(FoodEntry.on(day).fetch)
    }

    func log(_ entries: [FoodEntry]) async throws {
        try await store.write { db in
            for entry in entries {
                try entry.insert(db)
            }
        }.value
    }

    @Test func aCopyToAnHourConfirmsAndUndoRemovesOnlyTheCopies() async throws {
        let breakfast = [entry(minute: 482), entry(minute: 485, quantity: 2)]
        try await log(breakfast)
        let state = FoodLogState()
        state.copy(breakfast)

        state.paste(.copy, to: .hour(monday, hour: 16), in: store)
        #expect(!state.selecting)
        #expect(state.action == nil)
        #expect(state.notice?.message == "Copied 2 foods to Mon, Mar 3 at 4 PM")
        #expect(try await entries(on: monday).map(\.minute) == [482, 485, 960, 960])
        #expect(try await entries(on: monday).map(\.serving.quantity) == [1, 2, 1, 2])

        state.undo(in: store)
        #expect(state.notice == nil)
        #expect(try await entries(on: monday).map(\.id) == breakfast.map(\.id))
    }

    @Test func aSelectionAndItsCopyOrMoveOutliveAChangeOfDay() {
        let breakfast = [entry(minute: 482), entry(minute: 485)]
        let state = FoodLogState()
        state.day = monday
        state.selectHour(breakfast)
        state.day = monday.adding(days: 1)
        #expect(state.selectedEntries == breakfast)

        state.action = .move
        state.day = monday.adding(days: 2)
        #expect(state.action == .move)
        #expect(state.selectedEntries == breakfast)
    }

    @Test func aMovePastedOnAnotherDayLeavesItsDayOnceAndUndoReturnsIt() async throws {
        let breakfast = [entry(minute: 482), entry(minute: 485)]
        try await log(breakfast)
        let wednesday = monday.adding(days: 2)
        let state = FoodLogState()
        state.select(breakfast)
        state.action = .move
        state.day = wednesday

        state.paste(.move, to: .hour(wednesday, hour: 12), in: store)
        #expect(try await entries(on: monday).isEmpty)
        #expect(try await entries(on: wednesday).map(\.id) == breakfast.map(\.id))
        #expect(!state.selecting)

        state.undo(in: store)
        #expect(try await entries(on: monday).map(\.minute) == [482, 485])
        #expect(try await entries(on: wednesday).isEmpty)
    }

    @Test func stepBackLeavesCopyOrMoveForTheSelectionThenEndsIt() {
        let state = FoodLogState()
        state.select([entry(minute: 482)])
        state.action = .move
        state.day = monday.adding(days: 1)
        state.stepBack()
        #expect(state.selecting && state.action == nil)

        state.stepBack()
        #expect(!state.selecting)
    }

    @Test func deselectingTheLastEntryEndsSelectMode() {
        let breakfast = [entry(minute: 482), entry(minute: 485)]
        let state = FoodLogState()
        state.copy(breakfast)
        state.toggle(breakfast[0])
        #expect(state.action == .copy)
        state.selectHour([breakfast[1]])
        #expect(!state.selecting && state.action == nil)
    }

    @Test func anEntryRemovedFromItsDayLeavesTheSelection() {
        let breakfast = [entry(minute: 482), entry(minute: 485)]
        let other = FoodEntry(breakfast[0].portion, day: monday.adding(days: 1), minute: 600)
        let state = FoodLogState()
        state.select(breakfast + [other])
        state.shown([breakfast[1]], on: monday)
        #expect(state.selectedEntries == [breakfast[1], other])
    }

    @Test func undoingARemovalLogsBackWhatItRemovedNotTheSelection() async throws {
        let breakfast = [entry(minute: 482), entry(minute: 485, quantity: 2), entry(minute: 490)]
        try await log(breakfast)
        let state = FoodLogState()
        state.select(breakfast)
        _ = store.relocate([breakfast[1]], .move, to: .hour(monday, hour: 9))
        store.deleteEntries([breakfast[2].id])

        state.remove(state.selectedEntries, in: store)
        #expect(!state.selecting)
        #expect(try await entries(on: monday).isEmpty)

        state.undo(in: store)
        #expect(try await entries(on: monday).map(\.minute) == [482, 540])
        #expect(try await entries(on: monday).map(\.serving.quantity) == [1, 2])
    }

    @Test func undoingAMovePutsEachEntryBackAtItsOwnTime() async throws {
        let breakfast = [entry(minute: 482), entry(minute: 485)]
        try await log(breakfast)
        let state = FoodLogState()

        state.select(breakfast)
        state.paste(.move, to: .hour(monday.adding(days: 1), hour: 18), in: store)
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

        state.select(breakfast)
        state.paste(.move, to: .hour(monday, hour: 12), in: store)
        _ = store.relocate([breakfast[1]], .move, to: .hour(monday, hour: 13))
        state.undo(in: store)
        #expect(try await entries(on: monday).map(\.minute) == [482, 780])
    }

    @Test func undoingAMoveRestoresTheTimeTheMoveReplacedNotTheSelectedOne() async throws {
        let snack = entry(minute: 600)
        try await log([snack])
        _ = store.relocate([snack], .move, to: .hour(monday, hour: 11))
        let state = FoodLogState()

        state.select([snack])
        state.paste(.move, to: .hour(monday, hour: 15), in: store)
        #expect(try await entries(on: monday).map(\.minute) == [900])
        state.undo(in: store)
        #expect(try await entries(on: monday).map(\.minute) == [660])
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
