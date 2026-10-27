import SwiftUI

/// The food icons a custom food or recipe can pick. A food stores the icon's name; it draws as the emoji.
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

    /// The emoji a food draws: its stored icon by name, or the emoji itself (the dev seed and older imports store "🍌"),
    /// else the first icon its name mentions ("Bananas, raw", "Chicken, broilers or fryers, breast"). Nil draws the
    /// source's symbol.
    static func emoji(icon: String?, name: String?) -> String? {
        if let icon {
            if let choice = byName[icon] { return choice.emoji }
            if isEmoji(icon) { return icon }
        }
        return name.flatMap(mentioned)?.emoji
    }

    /// The icon a food's name mentions. Comma parts are read in order, since USDA names lead with the food ("Pepper,
    /// banana, raw"), and within a part the last word wins, since English names end with the food ("Banana bread").
    static func mentioned(in name: String) -> FoodIconChoice? {
        for part in name.split(separator: ",") {
            let words = FoodText.terms(String(part))
            for index in words.indices.reversed() {
                if index > 0, let choice = keywords["\(words[index - 1]) \(words[index])"] { return choice }
                if let choice = keywords[words[index]] { return choice }
            }
        }
        return nil
    }

    private static func isEmoji(_ text: String) -> Bool {
        guard text.count == 1, let first = text.unicodeScalars.first else { return false }
        return first.properties.isEmojiPresentation || text.unicodeScalars.contains("\u{FE0F}")
    }

    /// Words that name each icon, stemmed like search terms so "Bananas" and "Potatoes" find them. Two-word keys
    /// ("peanut butter") beat their last word.
    private static let keywords: [String: FoodIconChoice] = {
        let synonyms: [String: [String]] = [
            "orange": ["clementine", "mandarin", "tangerine"], "banana": ["plantain"], "grapes": ["grape", "raisin"],
            "blueberries": ["blueberry", "berry", "raspberry", "blackberry", "cranberry"], "melon": ["cantaloupe", "honeydew"],
            "cherries": ["cherry"], "peach": ["nectarine", "apricot", "plum"], "kiwi": ["kiwifruit"], "avocado": ["guacamole"],
            "tomato": ["salsa"], "sweet-potato": ["sweet potato", "yam"], "hot-pepper": ["hot pepper", "jalapeno", "chili pepper"],
            "bell-pepper": ["pepper", "bell pepper"], "cucumber": ["pickle"],
            "leafy-greens": ["spinach", "lettuce", "kale", "cabbage", "chard", "greens", "arugula"], "broccoli": ["cauliflower"],
            "onion": ["leek", "shallot", "scallion"], "mushroom": ["mushrooms"], "beef": ["steak", "veal", "bison"],
            "meat": ["pork", "lamb", "ham", "sausage", "venison", "jerky"], "chicken": ["turkey", "poultry"],
            "hamburger": ["burger", "cheeseburger"], "hot-dog": ["hot dog", "hotdog", "frankfurter"],
            "fish": ["salmon", "tuna", "cod", "tilapia", "trout", "sardine", "halibut", "mackerel", "haddock", "pollock", "anchovy"],
            "shrimp": ["prawn"], "oyster": ["clam", "mussel", "scallop"], "squid": ["octopus", "calamari"],
            "fried-egg": ["omelet", "omelette", "fried egg"], "milk": ["yogurt", "yoghurt", "kefir", "cream"],
            "cheese": ["cheddar", "mozzarella", "parmesan", "feta", "ricotta"], "butter": ["margarine", "ghee"],
            "bread": ["toast", "roll", "bun"], "flatbread": ["tortilla", "pita", "naan"], "pancakes": ["pancake", "crepe"],
            "pasta": ["spaghetti", "macaroni", "penne", "lasagna", "rotini", "fettuccine"], "noodles": ["noodle", "ramen", "udon"],
            "cereal": ["oat", "oatmeal", "granola", "muesli", "porridge"],
            "peanuts": ["peanut", "peanut butter", "almond", "cashew", "walnut", "pecan", "pistachio", "nut", "seed", "hazelnut"],
            "beans": ["bean", "lentil", "chickpea", "hummus", "pea", "tofu", "edamame"], "fries": ["fry", "french fry"],
            "stew": ["chili"], "soup": ["broth"], "ice-cream": ["ice cream", "gelato", "sorbet"], "soft-serve": ["frozen yogurt"],
            "cake": ["brownie", "cheesecake"], "cupcake": ["muffin"], "chocolate": ["cocoa"], "doughnut": ["donut"],
            "honey": ["syrup", "jam"], "coffee": ["espresso", "latte", "cappuccino"], "smoothie": ["soda", "cola", "soft drink"],
            "bubble-tea": ["bubble tea", "boba"], "cocktail": ["vodka", "whiskey", "rum", "gin", "liquor", "margarita"],
            "protein-shake": ["protein shake", "protein powder", "whey"],
        ]
        var keywords: [String: FoodIconChoice] = [:]
        for choice in all {
            for word in [choice.name.replacing("-", with: " ")] + (synonyms[choice.name] ?? []) {
                keywords[FoodText.terms(word).joined(separator: " ")] = choice
            }
        }
        return keywords
    }()
}

/// A food's icon everywhere it shows: its emoji (`FoodIconChoice.emoji`), else a symbol for where the food came from on
/// a round tile.
struct FoodIcon: View {
    let emoji: String?
    let source: FoodSource
    var size: CGFloat = 28

    init(food: FoodSnapshot, size: CGFloat = 28) {
        self.init(icon: food.icon, name: food.name, source: food.source, size: size)
    }

    init(icon: String?, name: String? = nil, source: FoodSource, size: CGFloat = 28) {
        emoji = FoodIconChoice.emoji(icon: icon, name: name)
        self.source = source
        self.size = size
    }

    var body: some View {
        Group {
            if let emoji {
                Text(emoji).font(.system(size: size * 0.78))
            } else {
                Image(systemName: symbol)
                    .font(.system(size: size * 0.42, weight: .semibold))
                    .foregroundStyle(Theme.textSecondary)
                    .frame(width: size, height: size)
                    .background(Theme.surfaceRaised, in: .circle)
            }
        }
        .frame(width: size, height: size)
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
                .padding(.horizontal, Theme.margin)
            }
            .background(Theme.background)
            .searchable(text: $query, prompt: "Search icons")
            .detailTitle("Choose Icon")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
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
