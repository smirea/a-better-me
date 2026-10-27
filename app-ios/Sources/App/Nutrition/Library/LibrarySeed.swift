#if DEBUG
import Foundation
import GRDB

/// The dev seed's (`DevSeed`) library: custom foods, recipes built from them and the seeded USDA foods, and favorites
/// at named servings. `FoodLogSeed` logs some of them on the seeded days, at full and partial servings.
enum LibrarySeed {
    private static func custom(_ key: String, _ name: String, _ icon: String, brand: String? = nil, _ nutrients: NutrientAmounts, grams: Double? = nil, milliliters: Double? = nil, measure: Measure, age days: Int) -> Food {
        var food = Food(name: name, brand: brand, nutrition: FoodNutrition(nutrients: nutrients, baseGrams: grams, baseMilliliters: milliliters, measures: [measure]))
        food.id = DevSeed.id("library/food/\(key)").uuidString.lowercased()
        food.icon = icon
        food.createdAt = .now.addingTimeInterval(-Double(days) * 86400)
        food.updatedAt = food.createdAt
        return food
    }

    static let whey = custom("whey", "Whey Protein", "protein-shake", brand: "Optimum Nutrition", [.energy: 120, .protein: 24, .fat: 1.5, .carbs: 3, "307": 130, "301": 130], grams: 31, measure: Measure(name: "scoop", quantity: 1, servings: 1), age: 40)
    static let sourdough = custom("sourdough", "Sourdough Bread", "bread", [.energy: 130, .protein: 5, .fat: 0.8, .carbs: 26, .fiber: 1.1, "307": 290], grams: 50, measure: Measure(name: "slice", quantity: 1, servings: 1), age: 32)
    static let granola = custom("granola", "Homemade Granola", "cereal", [.energy: 280, .protein: 7, .fat: 13, .carbs: 34, .fiber: 4, "304": 60], grams: 60, measure: Measure(name: "cup", quantity: 0.5, servings: 1), age: 21)
    static let coldBrew = custom("cold-brew", "Cold Brew with Oat Milk", "coffee", brand: "Chamberlain", [.energy: 90, .protein: 1, .fat: 3, .carbs: 14, "301": 120], milliliters: 330, measure: Measure(name: "bottle", quantity: 1, servings: 1), age: 9)

    static let egg = FoodSnapshot(
        source: .usda, name: "Egg, Whole, Raw", icon: "egg",
        nutrition: FoodNutrition(nutrients: [.energy: 72, .protein: 6.3, .fat: 4.8, .carbs: 0.4, "601": 186, "328": 1.1], baseGrams: 50, measures: [Measure(name: "large", quantity: 1, servings: 1)])
    )

    private static func recipe(
        _ key: String, _ name: String, _ icon: String, servings: Double, cookedGrams: Double? = nil, prep: Int?, cook: Int?,
        _ ingredients: [(FoodSnapshot, Double)], steps: [String], age days: Int
    ) -> Recipe {
        var recipe = Recipe(name: name, servings: servings)
        recipe.id = DevSeed.id("library/recipe/\(key)")
        recipe.icon = icon
        recipe.cookedGrams = cookedGrams
        recipe.prepMinutes = prep
        recipe.cookMinutes = cook
        recipe.steps = steps
        recipe.ingredients = ingredients.enumerated().map { index, item in
            let (food, quantity) = item
            var ingredient = RecipeIngredient(FoodPortion(food, serving: Serving(measure: food.nutrition.measures[0], quantity: quantity)))
            ingredient.id = DevSeed.id("library/recipe/\(key)/\(index)")
            return ingredient
        }
        recipe.createdAt = .now.addingTimeInterval(-Double(days) * 86400)
        recipe.updatedAt = recipe.createdAt
        return recipe
    }

    static let overnightOats = recipe(
        "overnight-oats", "Overnight Oats", "cereal", servings: 2, prep: 5, cook: nil,
        [(FoodLogSeed.oats, 1), (FoodLogSeed.yogurt, 1), (FoodLogSeed.banana, 1), (whey.snapshot, 1)],
        steps: ["Stir the oats, yogurt, and protein together with a splash of water.", "Slice the banana on top, cover, and refrigerate overnight."],
        age: 38
    )
    static let chickenRiceBowl = recipe(
        "chicken-rice-bowl", "Chicken Rice Bowl", "bento", servings: 2, cookedGrams: 590, prep: 10, cook: 25,
        [(FoodLogSeed.chicken, 2), (FoodLogSeed.rice, 1.5), (FoodLogSeed.salad, 1)],
        steps: ["Cook the rice.", "Grill the chicken breasts and slice them.", "Divide the rice, chicken, and salad between two bowls."],
        age: 30
    )
    static let salmonSalad = recipe(
        "salmon-salad", "Salmon Salad", "salad", servings: 1, prep: 5, cook: 15,
        [(FoodLogSeed.salmon, 1), (FoodLogSeed.salad, 2), (FoodLogSeed.almonds, 0.5)],
        steps: ["Bake the salmon at 200 °C for 12 to 15 minutes.", "Flake it over the salad and scatter the almonds."],
        age: 14
    )
    static let proteinPancakes = recipe(
        "protein-pancakes", "Protein Pancakes", "pancakes", servings: 2, cookedGrams: 330, prep: 5, cook: 10,
        [(FoodLogSeed.oats, 1), (FoodLogSeed.banana, 1), (whey.snapshot, 1), (egg, 2)],
        steps: ["Blend everything into a batter.", "Cook ladlefuls in a hot pan, two minutes a side."],
        age: 6
    )

    static let foods = [whey, sourdough, granola, coldBrew]
    static let recipes = [overnightOats, chickenRiceBowl, salmonSalad, proteinPancakes]

    /// Favorites at the servings the owner reaches for: half a cup of granola, one and a half ounces of almonds.
    static let favorites: [FoodFavorite] = [
        (FoodLogSeed.banana, 1.0), (granola.snapshot, 0.5), (FoodLogSeed.almonds, 1.5), (whey.snapshot, 1), (overnightOats.snapshot, 1),
    ].enumerated().map { index, item in
        let (food, quantity) = item
        var favorite = FoodFavorite(FoodPortion(food, serving: Serving(measure: food.nutrition.measures[0], quantity: quantity)), at: .now.addingTimeInterval(-Double(20 - index) * 86400))
        favorite.id = DevSeed.id("library/favorite/\(index)")
        return favorite
    }

    static func insert(in db: Database) throws {
        for food in foods { try LocalStore.put(food, in: db) }
        for recipe in recipes { try LocalStore.put(recipe, in: db) }
        for favorite in favorites { try LocalStore.put(favorite, in: db) }
    }
}
#endif
