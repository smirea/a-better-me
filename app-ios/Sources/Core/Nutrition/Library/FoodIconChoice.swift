import Foundation

/// The food icons a custom food or recipe can pick. A food stores the icon's name; it draws as the emoji.
struct FoodIconChoice: Identifiable, Hashable {
    let name: String
    let emoji: String
    let category: Category
    /// The name, category, keywords, and search-only words, folded, for the picker's search.
    private let searchText: String

    var id: String { name }

    enum Category: String, CaseIterable, Identifiable {
        case fruit = "Fruit", vegetables = "Vegetables", meats = "Meats", seafood = "Seafood", dairy = "Dairy & Eggs"
        case bakedGoods = "Baked Goods", grains = "Grains", nuts = "Nuts & Legumes", pantry = "Baking & Pantry"
        case prepared = "Prepared", sweets = "Sweets", drinks = "Drinks", supplements = "Supplements"

        var id: Self { self }
    }

    private init(name: String, emoji: String, category: Category) {
        self.name = name
        self.emoji = emoji
        self.category = category
        let words = [name.replacing("-", with: " "), category.rawValue] + (Self.synonyms[name] ?? []) + (Self.related[name] ?? [])
        searchText = Self.fold(words.joined(separator: "\n"))
    }

    static let all = table.map { FoodIconChoice(name: $0.0, emoji: $0.1, category: $0.2) }

    private static let table: [(String, String, Category)] = [
        ("apple", "🍎", .fruit), ("green-apple", "🍏", .fruit), ("pear", "🍐", .fruit), ("orange", "🍊", .fruit),
        ("lemon", "🍋", .fruit), ("lime", "🍋‍🟩", .fruit), ("banana", "🍌", .fruit), ("watermelon", "🍉", .fruit),
        ("grapes", "🍇", .fruit), ("strawberry", "🍓", .fruit), ("blueberries", "🫐", .fruit), ("melon", "🍈", .fruit),
        ("cherries", "🍒", .fruit), ("peach", "🍑", .fruit), ("mango", "🥭", .fruit), ("pineapple", "🍍", .fruit),
        ("coconut", "🥥", .fruit), ("kiwi", "🥝", .fruit), ("avocado", "🥑", .fruit), ("tomato", "🍅", .vegetables),
        ("eggplant", "🍆", .vegetables), ("potato", "🥔", .vegetables), ("sweet-potato", "🍠", .vegetables),
        ("carrot", "🥕", .vegetables), ("root-vegetable", "🫜", .vegetables), ("corn", "🌽", .vegetables),
        ("hot-pepper", "🌶️", .vegetables), ("bell-pepper", "🫑", .vegetables), ("cucumber", "🥒", .vegetables),
        ("leafy-greens", "🥬", .vegetables), ("broccoli", "🥦", .vegetables), ("pea-pod", "🫛", .vegetables),
        ("garlic", "🧄", .vegetables), ("onion", "🧅", .vegetables), ("ginger", "🫚", .vegetables),
        ("mushroom", "🍄‍🟫", .vegetables), ("herbs", "🌿", .vegetables), ("sprouts", "🌱", .vegetables),
        ("salad", "🥗", .vegetables), ("olive", "🫒", .vegetables),
        ("beef", "🥩", .meats), ("meat", "🍖", .meats), ("chicken", "🍗", .meats), ("bacon", "🥓", .meats),
        ("hamburger", "🍔", .meats), ("hot-dog", "🌭", .meats), ("fish", "🐟", .seafood), ("shrimp", "🍤", .seafood),
        ("sushi", "🍣", .seafood), ("fish-cake", "🍥", .seafood), ("crab", "🦀", .seafood), ("lobster", "🦞", .seafood),
        ("oyster", "🦪", .seafood), ("squid", "🦑", .seafood), ("egg", "🥚", .dairy), ("fried-egg", "🍳", .dairy),
        ("milk", "🥛", .dairy), ("cheese", "🧀", .dairy), ("butter", "🧈", .dairy), ("bread", "🍞", .bakedGoods),
        ("croissant", "🥐", .bakedGoods), ("baguette", "🥖", .bakedGoods), ("flatbread", "🫓", .bakedGoods),
        ("pretzel", "🥨", .bakedGoods), ("bagel", "🥯", .bakedGoods), ("pancakes", "🥞", .bakedGoods),
        ("waffle", "🧇", .bakedGoods), ("rice", "🍚", .grains), ("rice-ball", "🍙", .grains),
        ("rice-cracker", "🍘", .grains), ("pasta", "🍝", .grains), ("noodles", "🍜", .grains), ("cereal", "🥣", .grains),
        ("dumpling", "🥟", .grains), ("peanuts", "🥜", .nuts), ("beans", "🫘", .nuts), ("chestnut", "🌰", .nuts),
        ("flour", "🌾", .pantry), ("salt", "🧂", .pantry), ("oil", "🫗", .pantry), ("maple-syrup", "🍁", .pantry),
        ("canned-food", "🥫", .pantry), ("pizza", "🍕", .prepared), ("fries", "🍟", .prepared),
        ("sandwich", "🥪", .prepared), ("taco", "🌮", .prepared), ("burrito", "🌯", .prepared),
        ("stuffed-flatbread", "🥙", .prepared), ("tamale", "🫔", .prepared), ("falafel", "🧆", .prepared),
        ("stew", "🍲", .prepared), ("curry", "🍛", .prepared), ("fondue", "🫕", .prepared), ("bento", "🍱", .prepared),
        ("takeout", "🥡", .prepared), ("skewer", "🍢", .prepared), ("soup", "🥘", .prepared),
        ("popcorn", "🍿", .prepared), ("ice-cream", "🍨", .sweets), ("soft-serve", "🍦", .sweets),
        ("shaved-ice", "🍧", .sweets), ("cake", "🍰", .sweets), ("birthday-cake", "🎂", .sweets),
        ("cupcake", "🧁", .sweets), ("pie", "🥧", .sweets), ("custard", "🍮", .sweets), ("chocolate", "🍫", .sweets),
        ("candy", "🍬", .sweets), ("lollipop", "🍭", .sweets), ("cookie", "🍪", .sweets),
        ("fortune-cookie", "🥠", .sweets), ("doughnut", "🍩", .sweets), ("dango", "🍡", .sweets),
        ("mooncake", "🥮", .sweets), ("honey", "🍯", .sweets), ("coffee", "☕️", .drinks), ("tea", "🍵", .drinks),
        ("teapot", "🫖", .drinks), ("mate", "🧉", .drinks), ("juice", "🧃", .drinks), ("smoothie", "🥤", .drinks),
        ("bubble-tea", "🧋", .drinks), ("baby-bottle", "🍼", .drinks), ("beer", "🍺", .drinks), ("wine", "🍷", .drinks),
        ("champagne", "🍾", .drinks), ("sake", "🍶", .drinks), ("cocktail", "🍸", .drinks),
        ("tropical-drink", "🍹", .drinks), ("whiskey", "🥃", .drinks), ("water", "💧", .drinks), ("ice", "🧊", .drinks),
        ("pill", "💊", .supplements), ("supplement-powder", "🧪", .supplements), ("protein-shake", "🫙", .supplements),
        ("injection", "💉", .supplements), ("probiotic", "🦠", .supplements),
    ]

    private static let byName = Dictionary(uniqueKeysWithValues: all.map { ($0.name, $0) })

    static func named(_ name: String?) -> FoodIconChoice? { name.flatMap { byName[$0] } }

    /// Whether the picker's search finds this icon: the query appears in its name, its category, or any word that names
    /// it, so "pill", "sugar", "creatine", and "baking" all find icons.
    func matches(_ query: String) -> Bool {
        let query = Self.fold(query.trimmingCharacters(in: .whitespaces))
        return query.isEmpty || searchText.contains(query)
    }

    private static func fold(_ text: String) -> String {
        text.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil)
    }

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

    /// Words that name each icon in a food's name, besides the icon's own name. A word names one icon only.
    private static let synonyms: [String: [String]] = [
        "apple": ["applesauce", "apple sauce"], "orange": ["clementine", "mandarin", "tangerine"], "banana": ["plantain"],
        "grapes": ["grape", "raisin"], "blueberries": ["blueberry", "berry", "raspberry", "blackberry", "cranberry"],
        "melon": ["cantaloupe", "honeydew"], "cherries": ["cherry"], "peach": ["nectarine", "apricot", "plum"],
        "kiwi": ["kiwifruit"], "avocado": ["guacamole"], "tomato": ["salsa"], "sweet-potato": ["sweet potato", "yam"],
        "root-vegetable": ["beet", "beetroot", "radish", "turnip", "parsnip", "rutabaga", "celeriac", "celery root", "jicama"],
        "hot-pepper": ["hot pepper", "jalapeno", "chili pepper"], "bell-pepper": ["pepper", "bell pepper"],
        "cucumber": ["pickle"], "leafy-greens": ["spinach", "lettuce", "kale", "cabbage", "chard", "greens", "arugula", "brussels sprout"],
        "broccoli": ["cauliflower"], "pea-pod": ["snap pea", "snow pea", "green bean", "string bean", "pea pod"],
        "onion": ["leek", "shallot", "scallion"], "ginger": ["ginger root", "turmeric"], "mushroom": ["mushrooms"],
        "herbs": ["herb", "basil", "parsley", "cilantro", "coriander", "mint", "dill", "rosemary", "thyme", "oregano", "sage", "chive"],
        "sprouts": ["sprout", "microgreens", "alfalfa", "bean sprout"], "beef": ["steak", "veal", "bison"],
        "meat": ["pork", "lamb", "ham", "sausage", "venison", "jerky"], "chicken": ["turkey", "poultry"],
        "hamburger": ["burger", "cheeseburger"], "hot-dog": ["hot dog", "hotdog", "frankfurter"],
        "fish": ["salmon", "tuna", "cod", "tilapia", "trout", "sardine", "halibut", "mackerel", "haddock", "pollock", "anchovy"],
        "shrimp": ["prawn"], "fish-cake": ["kamaboko", "surimi", "imitation crab"], "oyster": ["clam", "mussel", "scallop"],
        "squid": ["octopus", "calamari"], "fried-egg": ["omelet", "omelette", "fried egg"],
        "milk": ["yogurt", "yoghurt", "kefir", "cream"], "cheese": ["cheddar", "mozzarella", "parmesan", "feta", "ricotta"],
        "butter": ["margarine", "ghee"], "bread": ["toast", "roll", "bun", "sourdough", "brioche"],
        "flatbread": ["tortilla", "pita", "naan"], "pancakes": ["pancake", "crepe"],
        "rice": ["quinoa", "couscous", "bulgur", "farro", "risotto"], "rice-cracker": ["cracker", "rice cake", "crispbread"],
        "pasta": ["spaghetti", "macaroni", "penne", "lasagna", "rotini", "fettuccine"], "noodles": ["noodle", "ramen", "udon"],
        "cereal": ["oat", "oatmeal", "granola", "muesli", "porridge", "protein bar"],
        "peanuts": ["peanut", "peanut butter", "almond", "cashew", "walnut", "pecan", "pistachio", "nut", "seed", "hazelnut"],
        "beans": ["bean", "lentil", "chickpea", "hummus", "pea", "tofu", "edamame"],
        "flour": [
            "wheat", "semolina", "cornmeal", "cornstarch", "starch", "barley", "rye", "bran", "gluten", "yeast",
            "baking powder", "baking soda", "baking mix", "xanthan gum",
        ],
        "salt": ["sea salt", "seasoning", "spice", "black pepper", "cinnamon", "paprika", "cumin", "nutmeg"],
        "oil": ["olive oil", "vegetable oil", "coconut oil", "canola", "lard", "shortening", "vinegar", "dressing"],
        "maple-syrup": ["maple", "maple syrup"],
        "canned-food": ["canned", "can", "ketchup", "marinara", "tomato sauce", "tomato paste"],
        "fries": ["fry", "french fry"], "stuffed-flatbread": ["gyro", "kebab", "kabob", "shawarma", "doner", "wrap"],
        "stew": ["chili"], "takeout": ["takeaway", "orange chicken", "chop suey"], "skewer": ["oden", "satay", "yakitori"],
        "soup": ["broth"], "ice-cream": ["ice cream", "gelato", "sorbet"], "soft-serve": ["frozen yogurt"],
        "shaved-ice": ["snow cone", "slushie", "slush", "granita", "italian ice"], "cake": ["brownie", "cheesecake"],
        "birthday-cake": ["layer cake"], "cupcake": ["muffin"],
        "custard": ["pudding", "flan", "creme brulee", "panna cotta"], "chocolate": ["cocoa"],
        "candy": [
            "sugar", "sweetener", "stevia", "sucralose", "erythritol", "xylitol", "allulose", "monk fruit", "dextrose",
            "caramel", "toffee", "gummy", "gum", "marshmallow", "jelly bean",
        ],
        "lollipop": ["lolly", "sucker"], "doughnut": ["donut"], "dango": ["mochi"], "mooncake": ["moon cake"],
        "honey": ["syrup", "jam", "jelly", "agave", "molasses", "marmalade", "preserves"],
        "coffee": ["espresso", "latte", "cappuccino"], "teapot": ["chai"], "mate": ["yerba mate", "yerba"],
        "smoothie": ["soda", "cola", "soft drink"], "bubble-tea": ["bubble tea", "boba"],
        "baby-bottle": ["formula", "infant formula", "baby formula"], "champagne": ["prosecco", "cava", "sparkling wine", "mimosa"],
        "sake": ["soju"], "cocktail": ["vodka", "rum", "gin", "liquor", "margarita"],
        "tropical-drink": ["pina colada", "mai tai", "daiquiri", "mojito", "punch"],
        "whiskey": ["whisky", "bourbon", "scotch", "brandy", "cognac"], "ice": ["ice cube"],
        "pill": [
            "capsule", "tablet", "softgel", "vitamin", "multivitamin", "supplement", "fish oil", "omega", "magnesium",
            "zinc", "calcium", "potassium", "iron", "biotin", "melatonin", "ashwagandha",
        ],
        "supplement-powder": [
            "creatine", "pre workout", "preworkout", "bcaa", "amino", "amino acid", "glutamine", "collagen",
            "electrolyte", "beta alanine", "psyllium", "greens powder",
        ],
        "protein-shake": ["protein shake", "protein powder", "whey", "casein", "mass gainer"],
        "injection": ["syringe", "injectable", "b12 shot"], "probiotic": ["prebiotic"],
    ]

    /// Words the picker's search finds an icon by that are no keyword for a food's name, since they name another icon
    /// there ("sugar" is candy) or too much ("sweetener").
    private static let related: [String: [String]] = [
        "salt": ["sugar", "sweetener"], "honey": ["sugar", "sweetener"], "maple-syrup": ["sugar", "sweetener"],
        "lollipop": ["sugar"], "egg": ["baking"], "butter": ["baking"], "milk": ["baking"],
        "supplement-powder": ["powder"], "pill": ["medicine"], "injection": ["medicine"],
    ]

    /// Words that name each icon, stemmed like search terms so "Bananas" and "Potatoes" find them. Two-word keys
    /// ("peanut butter") beat their last word.
    private static let keywords: [String: FoodIconChoice] = {
        var keywords: [String: FoodIconChoice] = [:]
        for choice in all {
            for word in [choice.name.replacing("-", with: " ")] + (synonyms[choice.name] ?? []) {
                keywords[FoodText.terms(word).joined(separator: " ")] = choice
            }
        }
        return keywords
    }()
}
