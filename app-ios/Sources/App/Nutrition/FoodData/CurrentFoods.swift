import GRDB

/// What each food key (`FoodSearchResult.key`) stands for now: the owner's correction of it (`Food.replaces`), else its
/// stored food or recipe as last saved. Logged entries keep what was logged, but whatever offers a food to log again
/// (search, a scan, Latest, Picks, Ramble) reads it through this, so a corrected or edited food, or a recipe whose
/// ingredient was corrected, never offers its old values.
struct CurrentFoods: Sendable {
    private var foods: [String: Food] = [:]
    private var snapshots: [String: FoodSnapshot] = [:]

    init(_ stored: [Food], recipes: [Recipe] = []) {
        let live = stored.filter { !$0.isArchived }
        for food in live { foods[food.id] = food }
        for food in live {
            if let replaced = food.replaces { foods[replaced] = food }
        }
        snapshots = foods.mapValues(\.snapshot)
        for recipe in recipes where !recipe.isArchived {
            let snapshot = recipe.snapshot
            if let key = snapshot.foodID { snapshots[key] = snapshot }
        }
    }

    static func read(_ db: Database) throws -> CurrentFoods {
        CurrentFoods(try Food.filter(Column("archived") == false).fetchAll(db), recipes: try Recipe.filter(Column("archived") == false).fetchAll(db))
    }

    func food(_ key: String) -> Food? { foods[key] }

    /// The key a food is listed under now: its correction's id, else its own key.
    func key(_ key: String) -> String { foods[key]?.id ?? key }

    /// The portion with its food as stored now, at the same quantity of its measure (`Serving.fitted`). An altered
    /// recipe's snapshot holds its alterations, which its recipe lacks, so only unaltered portions are passed here.
    func resolve(_ portion: FoodPortion) -> FoodPortion {
        guard let snapshot = snapshots[FoodSearchResult.key(portion.food)], snapshot != portion.food else { return portion }
        return FoodPortion(snapshot, serving: portion.serving.fitted(to: snapshot.nutrition))
    }

    /// A logged entry's portion to log again: as stored now, except an altered recipe, which logs its alterations.
    func resolve(_ entry: FoodEntry) -> FoodPortion {
        entry.alterations == nil ? resolve(entry.portion) : entry.portion
    }
}

/// What Update edits for a logged food: the owner's own food, in place, or for a USDA or Open Food Facts food a new
/// copy of it that replaces it everywhere once saved.
enum FoodUpdate: Identifiable, Sendable {
    case edit(Food)
    /// The unsaved copy, its `replaces` set.
    case replace(Food)

    var food: Food {
        switch self {
        case let .edit(food), let .replace(food): food
        }
    }

    var id: String { food.id }

    /// A food already corrected edits its correction, so one food never gains two. The copy starts from the snapshot the
    /// owner is looking at, with the stored row's barcode and store, so a scan of the package finds it.
    static func of(_ snapshot: FoodSnapshot, in db: Database) throws -> FoodUpdate {
        let key = FoodSearchResult.key(snapshot)
        let current = try CurrentFoods.read(db).food(key)
        if let current, current.source == .custom { return .edit(current) }
        var copy = Food(name: snapshot.name, brand: snapshot.brand, barcode: current?.barcode, nutrition: snapshot.nutrition)
        copy.store = current?.store
        copy.icon = snapshot.icon
        copy.replaces = key
        return .replace(copy)
    }
}
