import GRDB

/// What each food key (`FoodSearchResult.key`) stands for now: the owner's correction of it (`Food.replaces`), else its
/// stored row as last saved. Logged entries keep what was logged, but whatever offers a food to log again (search, a
/// scan, Latest, Picks, Ramble) reads it through this, so a corrected or edited food never offers its old values.
struct CurrentFoods: Sendable {
    private var foods: [String: Food] = [:]

    init(_ stored: [Food]) {
        let live = stored.filter { !$0.isArchived }
        for food in live { foods[food.id] = food }
        for food in live {
            if let replaced = food.replaces { foods[replaced] = food }
        }
    }

    static func read(_ db: Database) throws -> CurrentFoods {
        CurrentFoods(try Food.filter(Column("archived") == false).fetchAll(db))
    }

    func food(_ key: String) -> Food? { foods[key] }

    /// The key a food is listed under now: its correction's id, else its own key.
    func key(_ key: String) -> String { foods[key]?.id ?? key }

    /// The portion with its food as stored now, at the same quantity of its measure (`Serving.fitted`).
    func resolve(_ portion: FoodPortion) -> FoodPortion {
        guard let food = foods[FoodSearchResult.key(portion.food)] else { return portion }
        let snapshot = food.snapshot
        guard snapshot != portion.food else { return portion }
        return FoodPortion(snapshot, serving: portion.serving.fitted(to: food.nutrition))
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
