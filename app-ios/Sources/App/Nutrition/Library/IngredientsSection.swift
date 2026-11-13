import SwiftUI

/// A recipe's ingredients, read only, as every screen that shows them draws them: the recipe page, Prepare, the
/// logger's food detail, and a logged recipe's entry editor. An altered recipe's changed ingredient adds the recipe's
/// amount under it, a removed one is struck through, and an added one is green, as its tile draws them. `leading` rows
/// sit above the ingredients in the same section, such as Prepare's servings stepper. A recipe with no ingredients
/// shows no section.
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
            ThemedSection(ingredients.isAltered ? "Ingredients, Altered" : "Ingredients") {
                leading
                ForEach(ingredients) { line in
                    switch (line.change, line.original, line.serving) {
                    case let (.removed, original?, _):
                        FoodRow(food: line.food, serving: original)
                            .strikethrough()
                            .opacity(0.5)
                            .accessibilityLabel("Removed \(line.food.displayName), \(NutritionFormat.serving(original))")
                    case let (.changed, original?, eaten?):
                        VStack(alignment: .leading, spacing: 2) {
                            FoodRow(food: line.food, serving: eaten)
                            Text("Was \(NutritionFormat.serving(original))")
                                .font(AppFont.rowDetail)
                                .foregroundStyle(Theme.textSecondary)
                                .padding(.leading, 40)
                        }
                        .accessibilityElement(children: .combine)
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
