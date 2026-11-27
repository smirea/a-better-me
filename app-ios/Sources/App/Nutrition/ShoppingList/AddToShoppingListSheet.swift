import Feedback
import SwiftUI

/// Puts a recipe's ingredients on a ShopALotl list: pick the list (the last one used, the first list until then, or a
/// new one), untick what is already in the pantry, and add. ShopALotl merges what is already on the list.
struct AddToShoppingListSheet: View {
    let recipe: Recipe
    /// The ingredients at the amounts being cooked, which Prepare scales.
    let ingredients: [RecipeIngredient]

    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @AppStorage("shoppingList.lastListID") private var lastListID = ShopALotl.mainListID
    @State private var lists: [ShopALotl.List]?
    @State private var lines: [ShoppingLine] = []
    @State private var skipped: Set<String> = []
    @State private var choice: Choice = .list(ShopALotl.mainListID)
    @State private var newName = ""
    @State private var problem: String?
    @State private var adding = false
    @State private var added: ShopALotl.Added?
    @FocusState private var naming: Bool

    private enum Choice: Hashable {
        case list(String)
        case new
    }

    var body: some View {
        NavigationStack {
            Group {
                if let added { result(added) } else { form }
            }
            .detailTitle("Add to Shopping List", subtitle: recipe.name)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .sensoryFeedback(.success, trigger: added != nil) { _, new in new }
        .task { await load() }
        .feedback(self)
    }

    private var form: some View {
        Form {
            ThemedSection("List") {
                if let lists {
                    ForEach(lists) { list in
                        option(.list(list.id)) {
                            RowLabel(title: Text(list.name), detail: list.needed > 0 ? Text("\(list.needed) needed") : nil)
                        }
                    }
                    option(.new) {
                        if choice == .new {
                            TextField("New list name", text: $newName)
                                .font(AppFont.rowTitle)
                                .focused($naming)
                                .submitLabel(.done)
                        } else {
                            RowLabel(title: Text("New List"), systemImage: "plus")
                        }
                    }
                } else if problem == nil {
                    ProgressView().frame(maxWidth: .infinity)
                }
                if let problem {
                    Text(problem).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                    if lists == nil {
                        Button("Try Again") { Task { await load() } }
                    }
                }
            }
            ThemedSection("Ingredients") {
                ForEach(lines) { line in
                    Button {
                        if !skipped.insert(line.id).inserted { skipped.remove(line.id) }
                    } label: {
                        HStack(spacing: 12) {
                            SelectionMark(isOn: !skipped.contains(line.id), style: .check)
                            Text(line.name).font(AppFont.rowTitle).foregroundStyle(Theme.textPrimary)
                            Spacer(minLength: 8)
                            Text(line.quantity).font(AppFont.rowDetail.monospacedDigit()).foregroundStyle(Theme.textSecondary)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(skipped.contains(line.id) ? [] : .isSelected)
                }
            }
        }
        .flatList()
        .pinnedActions {
            PinnedActionButton(adding ? "Adding…" : addTitle) { Task { await add() } }
                .disabled(!canAdd)
        }
    }

    private func option<Label: View>(_ option: Choice, @ViewBuilder label: () -> Label) -> some View {
        Button {
            choice = option
            naming = option == .new
        } label: {
            HStack(spacing: 12) {
                label()
                Spacer(minLength: 8)
                SelectionMark(isOn: choice == option)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(choice == option ? .isSelected : [])
    }

    private func result(_ added: ShopALotl.Added) -> some View {
        ContentUnavailableView {
            Label("Added to \(added.list.name)", systemImage: "checkmark.circle.fill")
        } description: {
            Text(summary(added))
        }
        .pinnedActions {
            PinnedActionButton("Open ShopALotl") {
                openURL(ShopALotl.listURL(added.list.id))
                dismiss()
            }
        }
    }

    private var chosenLines: [ShoppingLine] { lines.filter { !skipped.contains($0.id) } }

    private var addTitle: String {
        chosenLines.count == 1 ? "Add 1 Item" : "Add \(chosenLines.count) Items"
    }

    private var trimmedName: String { newName.trimmingCharacters(in: .whitespacesAndNewlines) }

    private var canAdd: Bool {
        guard lists != nil, !adding, !chosenLines.isEmpty else { return false }
        return choice != .new || !trimmedName.isEmpty
    }

    private func summary(_ added: ShopALotl.Added) -> String {
        let new = added.added == 1 ? "1 item" : "\(added.added) items"
        guard added.alreadyNeeded > 0 else { return "\(new) added." }
        return "\(new) added, \(added.alreadyNeeded) already on the list."
    }

    private func load() async {
        let ingredients = ingredients
        if lines.isEmpty {
            let names = (try? await store.read { try ShoppingLines.shortNames($0, for: ingredients) }) ?? [:]
            lines = ShoppingLines.lines(ingredients, shortNames: names)
        }
        problem = nil
        do {
            let fetched = try await ShopALotl.lists()
            lists = fetched
            // A list deleted in ShopALotl since it was last used falls back to the first list.
            choice = .list(fetched.contains { $0.id == lastListID } ? lastListID : ShopALotl.mainListID)
        } catch {
            problem = error.localizedDescription
        }
    }

    private func add() async {
        let destination: ShopALotl.Destination = switch choice {
        case let .list(id): .list(id: id)
        case .new: .new(name: trimmedName)
        }
        adding = true
        defer { adding = false }
        problem = nil
        do {
            let items = chosenLines.map { ShopALotl.Item(name: $0.name, quantity: $0.quantity) }
            let result = try await ShopALotl.add(items, to: destination, recipeID: recipe.id, recipeName: recipe.name)
            lastListID = result.list.id
            added = result
        } catch {
            problem = error.localizedDescription
        }
    }
}
