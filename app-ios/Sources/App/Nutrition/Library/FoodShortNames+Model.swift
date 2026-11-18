import Foundation
import FoundationModels

/// Apple's on-device general model with greedy sampling, as `OnDeviceFoodIconModel` uses it. A regex guide limiting
/// the answer to two words fails with UnsupportedGuide, so `FoodShortName.cleaned` cuts a longer one instead. The
/// instructions are the best of eight measured on 55 names (`FoodShortNamesTests`): an example kind such as "sourdough
/// bread" made the model name other breads sourdough, and "in words from its name" stopped it inventing kinds.
struct OnDeviceFoodShortNameModel: FoodShortNameModel {
    private let model = SystemLanguageModel.default

    var isAvailable: Bool { model.isAvailable }

    func shortName(for food: String) async throws -> String {
        let session = LanguageModelSession(model: model, instructions: Self.instructions)
        return try await session.respond(to: "Food: \(food)", generating: ShortFoodName.self, options: GenerationOptions(samplingMode: .greedy)).content.name
    }

    private static let instructions = """
        You give each food in a nutrition log a short name of one or two words: the food itself, as a person would \
        call it, in words from its name. Keep the word that tells it apart from similar foods, such as olive oil, \
        almond milk, or protein bar. Name what the food is, never only its flavor. Leave out the brand, which follows \
        "By", and words such as organic, raw, cooked, or plain. USDA names lead with the food and list details after \
        commas: "Pepper, banana, raw" is "Banana pepper". Translate a foreign name to English.
        """
}

@Generable
private struct ShortFoodName {
    @Guide(description: "What a person calls the food, one or two words")
    var name: String
}

extension FoodShortNaming {
    static let shared = FoodShortNaming(model: OnDeviceFoodShortNameModel())
}
