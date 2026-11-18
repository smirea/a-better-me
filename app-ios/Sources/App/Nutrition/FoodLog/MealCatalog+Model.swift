import Foundation
import FoundationModels

/// Apple's on-device general model, as `OnDeviceFoodIconModel` uses it, with greedy sampling, so a meal gets the same
/// suggestion on every device.
struct OnDeviceMealNameModel: MealNameModel {
    private let model = SystemLanguageModel.default

    var isAvailable: Bool { model.isAvailable }

    func name(for foods: [String]) async throws -> String {
        let session = LanguageModelSession(model: model, instructions: Self.instructions)
        let prompt = "Foods:\n" + foods.map { "- \($0)" }.joined(separator: "\n")
        let title = try await session.respond(to: prompt, generating: MealTitle.self, options: GenerationOptions(samplingMode: .greedy)).content
        return MealCatalog.titled(title.name, from: title.foods)
    }

    /// The owner wants every name drawn from at least two of the meal's foods. Version 1's instructions, whose example
    /// was "Matcha Granola Bowl", gave 7 of 14 real meals a name sharing a word with two of their foods, and the phone
    /// named the owner's breakfast after its recipe alone. These name all 14 from two foods on macOS 27's model
    /// (2026-11-17), "Granola and Pomegranate" or "Pasta and Sauce" for rotini with pasta sauce. Model versions differ,
    /// so the model also picks the two foods before the name (`MealTitle.foods`), and `MealCatalog.titled` holds the
    /// name to them.
    private static let instructions = """
        You name meals in a food log. Given the foods eaten together and their amounts, first pick the two foods \
        that make up most of the meal and call each what a person would. Then name the meal from both of them, as a \
        person would say it, such as "Chicken and Rice", "Bagel and Cream Cheese", "Peanut Butter Banana Toast", or \
        "Granola Bowl with Pomegranate". No brands or amounts.
        """
}

/// Generated in order, so the model commits to two foods before it writes the name.
@Generable
private struct MealTitle {
    @Guide(description: "The two foods that make up most of the meal, each as a person calls it in one or two words", .count(2))
    var foods: [String]
    @Guide(description: "The meal's name in two to five words, title case, naming both foods")
    var name: String
}

extension MealCatalog {
    convenience init() {
        self.init(model: OnDeviceMealNameModel())
    }
}
