import SwiftUI

/// The food icons a custom food or recipe can pick. A food stores the icon's name; it draws as the emoji. A name this
/// list does not know (or none) draws a symbol for where the food came from.
struct FoodIconChoice: Identifiable, Hashable {
    let name: String
    let emoji: String
    let category: Category

    var id: String { name }

    enum Category: String, CaseIterable, Identifiable {
        case fruit = "Fruit", vegetables = "Vegetables", meats = "Meats", seafood = "Seafood", dairy = "Dairy & Eggs"
        case bakedGoods = "Baked Goods", grains = "Grains", nuts = "Nuts & Legumes", prepared = "Prepared", sweets = "Sweets"
        case drinks = "Drinks"

        var id: Self { self }
    }

    static let all = table.map { FoodIconChoice(name: $0.0, emoji: $0.1, category: $0.2) }

    private static let table: [(String, String, Category)] = [
        ("apple", "🍎", .fruit), ("green-apple", "🍏", .fruit), ("pear", "🍐", .fruit), ("orange", "🍊", .fruit),
        ("lemon", "🍋", .fruit), ("lime", "🍋‍🟩", .fruit), ("banana", "🍌", .fruit), ("watermelon", "🍉", .fruit),
        ("grapes", "🍇", .fruit), ("strawberry", "🍓", .fruit), ("blueberries", "🫐", .fruit), ("melon", "🍈", .fruit),
        ("cherries", "🍒", .fruit), ("peach", "🍑", .fruit), ("mango", "🥭", .fruit), ("pineapple", "🍍", .fruit),
        ("coconut", "🥥", .fruit), ("kiwi", "🥝", .fruit), ("avocado", "🥑", .fruit), ("tomato", "🍅", .vegetables),
        ("eggplant", "🍆", .vegetables), ("potato", "🥔", .vegetables), ("sweet-potato", "🍠", .vegetables),
        ("carrot", "🥕", .vegetables), ("corn", "🌽", .vegetables), ("hot-pepper", "🌶️", .vegetables),
        ("bell-pepper", "🫑", .vegetables), ("cucumber", "🥒", .vegetables), ("leafy-greens", "🥬", .vegetables),
        ("broccoli", "🥦", .vegetables), ("garlic", "🧄", .vegetables), ("onion", "🧅", .vegetables),
        ("mushroom", "🍄‍🟫", .vegetables), ("salad", "🥗", .vegetables), ("olive", "🫒", .vegetables),
        ("beef", "🥩", .meats), ("meat", "🍖", .meats), ("chicken", "🍗", .meats), ("bacon", "🥓", .meats),
        ("hamburger", "🍔", .meats), ("hot-dog", "🌭", .meats), ("fish", "🐟", .seafood), ("shrimp", "🍤", .seafood),
        ("sushi", "🍣", .seafood), ("crab", "🦀", .seafood), ("lobster", "🦞", .seafood), ("oyster", "🦪", .seafood),
        ("squid", "🦑", .seafood), ("egg", "🥚", .dairy), ("fried-egg", "🍳", .dairy), ("milk", "🥛", .dairy),
        ("cheese", "🧀", .dairy), ("butter", "🧈", .dairy), ("bread", "🍞", .bakedGoods), ("croissant", "🥐", .bakedGoods),
        ("baguette", "🥖", .bakedGoods), ("flatbread", "🫓", .bakedGoods), ("pretzel", "🥨", .bakedGoods),
        ("bagel", "🥯", .bakedGoods), ("pancakes", "🥞", .bakedGoods), ("waffle", "🧇", .bakedGoods),
        ("rice", "🍚", .grains), ("rice-ball", "🍙", .grains), ("pasta", "🍝", .grains), ("noodles", "🍜", .grains),
        ("cereal", "🥣", .grains), ("dumpling", "🥟", .grains), ("peanuts", "🥜", .nuts), ("beans", "🫘", .nuts),
        ("chestnut", "🌰", .nuts), ("pizza", "🍕", .prepared), ("fries", "🍟", .prepared), ("sandwich", "🥪", .prepared),
        ("taco", "🌮", .prepared), ("burrito", "🌯", .prepared), ("tamale", "🫔", .prepared), ("falafel", "🧆", .prepared),
        ("stew", "🍲", .prepared), ("curry", "🍛", .prepared), ("fondue", "🫕", .prepared), ("bento", "🍱", .prepared),
        ("soup", "🥘", .prepared), ("popcorn", "🍿", .prepared), ("ice-cream", "🍨", .sweets), ("soft-serve", "🍦", .sweets),
        ("cake", "🍰", .sweets), ("cupcake", "🧁", .sweets), ("pie", "🥧", .sweets), ("chocolate", "🍫", .sweets),
        ("candy", "🍬", .sweets), ("cookie", "🍪", .sweets), ("doughnut", "🍩", .sweets), ("honey", "🍯", .sweets),
        ("coffee", "☕️", .drinks), ("tea", "🍵", .drinks), ("juice", "🧃", .drinks), ("smoothie", "🥤", .drinks),
        ("bubble-tea", "🧋", .drinks), ("beer", "🍺", .drinks), ("wine", "🍷", .drinks), ("cocktail", "🍸", .drinks),
        ("water", "💧", .drinks), ("protein-shake", "🫙", .drinks),
    ]

    private static let byName = Dictionary(uniqueKeysWithValues: all.map { ($0.name, $0) })

    static func named(_ name: String?) -> FoodIconChoice? { name.flatMap { byName[$0] } }
}

/// A food's icon everywhere it shows: the picked emoji, else a symbol for where the food came from, on a round tile.
struct FoodIcon: View {
    let icon: String?
    let source: FoodSource
    var size: CGFloat = 34

    init(food: FoodSnapshot, size: CGFloat = 34) {
        self.init(icon: food.icon, source: food.source, size: size)
    }

    init(icon: String?, source: FoodSource, size: CGFloat = 34) {
        self.icon = icon
        self.source = source
        self.size = size
    }

    var body: some View {
        Group {
            if let choice = FoodIconChoice.named(icon) {
                Text(choice.emoji).font(.system(size: size * 0.6))
            } else {
                Image(systemName: symbol)
                    .font(.system(size: size * 0.42, weight: .semibold))
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        .frame(width: size, height: size)
        .background(Theme.surfaceRaised, in: .circle)
        .accessibilityHidden(true)
    }

    private var symbol: String {
        switch source {
        case .recipe: "frying.pan"
        case .quickAdd: "bolt.fill"
        case .openFoodFacts: "barcode"
        case .custom: "fork.knife"
        case .usda: "leaf"
        }
    }
}

/// Choose Icon: every icon by category, with a search over the names.
struct FoodIconPicker: View {
    @Binding var selection: String?
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 52), spacing: 8)], spacing: 8, pinnedViews: .sectionHeaders) {
                    ForEach(FoodIconChoice.Category.allCases) { category in
                        let icons = FoodIconChoice.all.filter { $0.category == category && matches($0) }
                        if !icons.isEmpty {
                            Section {
                                ForEach(icons) { icon in
                                    Button { choose(icon.name) } label: {
                                        Text(icon.emoji)
                                            .font(.system(size: 30))
                                            .frame(width: 52, height: 52)
                                            .background(selection == icon.name ? Theme.surfaceRaised : Theme.surface, in: .rect(cornerRadius: Theme.smallCornerRadius))
                                    }
                                    .buttonStyle(.plain)
                                    .accessibilityLabel(icon.name.replacing("-", with: " "))
                                    .accessibilityAddTraits(selection == icon.name ? .isSelected : [])
                                }
                            } header: {
                                SectionTitle(category.rawValue)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.vertical, 6)
                                    .background(Theme.background)
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
            }
            .background(Theme.background)
            .searchable(text: $query, prompt: "Search icons")
            .detailTitle("Choose Icon")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", systemImage: "xmark") { dismiss() }
                }
                ToolbarItem(placement: .destructiveAction) {
                    Button("Default") { choose(nil) }
                }
            }
        }
    }

    private func matches(_ icon: FoodIconChoice) -> Bool {
        query.isEmpty || icon.name.replacing("-", with: " ").localizedCaseInsensitiveContains(query)
    }

    private func choose(_ name: String?) {
        selection = name
        dismiss()
    }
}
