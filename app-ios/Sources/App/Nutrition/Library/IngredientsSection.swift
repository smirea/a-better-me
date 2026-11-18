import SwiftUI

/// A recipe's ingredients, read only, as every screen that shows them draws them: the recipe page, Prepare, the
/// logger's food detail, and a logged recipe's entry editor. An altered recipe marks its changes as its tile does: a
/// changed amount in yellow, a removed ingredient struck through at the recipe's amount, and an added one in green.
/// `leading` rows sit above the ingredients in the same section, such as Prepare's servings stepper. A recipe with no
/// ingredients shows no section.
struct IngredientsSection<Leading: View>: View {
    let ingredients: [IngredientAlteration]
    @ViewBuilder var leading: Leading

    init(_ ingredients: [IngredientAlteration], @ViewBuilder leading: () -> Leading = { EmptyView() }) {
        self.ingredients = ingredients
        self.leading = leading()
    }

    init(_ ingredients: [RecipeIngredient], @ViewBuilder leading: () -> Leading = { EmptyView() }) {
        self.init(ingredients.map(IngredientAlteration.init(kept:)), leading: leading)
    }

    var body: some View {
        if !ingredients.isEmpty {
            ThemedSection("Ingredients") {
                leading
                ForEach(ingredients) { line in
                    switch (line.change, line.original, line.serving) {
                    case let (.removed, original?, _):
                        FoodRow(food: line.food, serving: original)
                            .strikethrough()
                            .opacity(0.5)
                            .accessibilityLabel("Removed \(line.food.displayName), \(NutritionFormat.serving(original))")
                    case let (.changed, original?, eaten?):
                        FoodRow(food: line.food, serving: eaten, servingColor: Theme.ratingYellow)
                            .accessibilityLabel("\(line.food.displayName), \(NutritionFormat.serving(eaten)), changed from \(NutritionFormat.serving(original))")
                    case let (.added, _, eaten?):
                        FoodRow(food: line.food, serving: eaten, titleColor: Theme.ratingGreen)
                            .accessibilityLabel("Added \(line.food.displayName), \(NutritionFormat.serving(eaten))")
                    case let (_, _, eaten?):
                        FoodRow(food: line.food, serving: eaten)
                    default:
                        EmptyView()
                    }
                }
            }
        }
    }
}
