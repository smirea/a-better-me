import Feedback
import SwiftUI

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
        self.init(emoji: FoodIconChoice.emoji(icon: icon, name: name), source: source, size: size)
    }

    /// An emoji already resolved by `FoodIconChoice.emoji`, for a row that resolves it once outside `body`.
    init(emoji: String?, source: FoodSource, size: CGFloat = 28) {
        self.emoji = emoji
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

extension FoodIcon {
    /// The icon as the button that opens the icon picker, with a pencil badge so it reads as one, in place of an Edit
    /// Icon button beside the name.
    func editsIcon(_ edit: @escaping () -> Void) -> some View {
        Button(action: edit) {
            self.overlay(alignment: .bottomTrailing) {
                Image(systemName: "pencil")
                    .font(.system(size: size * 0.24, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
                    .frame(width: size * 0.42, height: size * 0.42)
                    .background(Theme.surfaceRaised, in: .circle)
                    .offset(x: size * 0.12, y: size * 0.08)
            }
        }
        .buttonStyle(.borderless)
        .accessibilityLabel("Edit Icon")
    }
}

/// Choose Icon: every icon by category, with a search over their names, categories, and keywords.
struct FoodIconPicker: View {
    @Binding var selection: String?
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var position = ScrollPosition(edge: .top)

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 52), spacing: 8)], spacing: 8, pinnedViews: .sectionHeaders) {
                    ForEach(FoodIconChoice.Category.allCases) { category in
                        let icons = FoodIconChoice.all.filter { $0.category == category && $0.matches(query) }
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
            .scrollPosition($position)
            // A search shrinks the grid under the offset the full list was scrolled to, which leaves it blank.
            .onChange(of: query) { position.scrollTo(edge: .top) }
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
        .feedback(self)
    }

    private func choose(_ name: String?) {
        selection = name
        dismiss()
    }
}
