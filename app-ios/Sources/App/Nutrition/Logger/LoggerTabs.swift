import SwiftUI

/// Search (`log-02-search-results.jpg`): Latest when the field is empty, otherwise the groups `FoodSearch` returns, with
/// the field and Log Foods at the bottom.
struct SearchTab: View {
    let session: LoggerSession
    let open: (LoggerPick) -> Void
    @Observe(AppSettings.current) private var settings
    @State private var text = ""
    @FocusState private var focused: Bool

    var body: some View {
        List {
            if session.query.isEmpty {
                ThemedSection("Latest") { rows(session.results) }
            } else {
                ForEach(groups, id: \.0) { group, results in
                    Section(group.title) { rows(results) }
                }
                if session.isSearchingBranded {
                    Section(FoodSearchGroup.branded.title) {
                        ProgressView().frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .themedList()
        .overlay {
            if session.results.isEmpty, !session.isSearchingBranded {
                if session.query.isEmpty {
                    ContentUnavailableView("No foods logged yet", systemImage: "magnifyingglass", description: Text("Search for a food to log it."))
                } else {
                    ContentUnavailableView.search(text: session.query)
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            LoggerBottomBar(session: session) {
                TextField("Search for a food", text: $text)
                    .focused($focused)
                    .submitLabel(.search)
                    .autocorrectionDisabled()
            }
        }
        .onAppear {
            text = session.query
            if session.plate.isEmpty { focused = true }
        }
        .onChange(of: text) { session.setQuery(text, branded: settings.nutrition.searchBranded) }
    }

    private var groups: [(FoodSearchGroup, [FoodSearchResult])] {
        var groups: [(FoodSearchGroup, [FoodSearchResult])] = []
        for result in session.results {
            if groups.last?.0 == result.group {
                groups[groups.count - 1].1.append(result)
            } else {
                groups.append((result.group, [result]))
            }
        }
        return groups
    }

    private func rows(_ results: [FoodSearchResult]) -> some View {
        ForEach(results) { result in
            HStack(spacing: 12) {
                Button {
                    focused = false
                    open(LoggerPick(result))
                } label: {
                    FoodRow(food: result.portion.food, serving: result.portion.serving)
                }
                .buttonStyle(.plain)
                AddToPlateButton(food: result.portion.food) { session.add(LoggerPick(result)) }
            }
        }
    }
}

extension FoodSearchGroup {
    var title: String {
        switch self {
        case .history: "From History"
        case .favorites: "Favorites"
        case .custom: "Your Foods"
        case .recipes: "Recipes"
        case .common: "Common"
        case .branded: "Branded"
        }
    }
}

/// A tab's bottom bar: its field in a glass capsule and Log Foods.
struct LoggerBottomBar<Field: View>: View {
    let session: LoggerSession
    @ViewBuilder let field: () -> Field

    var body: some View {
        GlassEffectContainer {
            HStack(spacing: 10) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").foregroundStyle(Theme.textSecondary)
                    field()
                }
                .padding(.horizontal, 16)
                .frame(height: 48)
                .glassEffect(.regular.interactive(), in: .capsule)
                LogFoodsButton(session: session)
                    .controlSize(.large)
            }
        }
        .padding(.horizontal, Theme.margin)
        .padding(.bottom, 8)
    }
}

/// Quick Add (`log-06-quick-add.jpg`): energy in kcal or kJ with the macro sum under it, the macros and alcohol in grams,
/// and an optional name. Quick Add puts it on the plate as one serving; Log Foods logs the plate with it.
struct QuickAddTab: View {
    let session: LoggerSession
    @Observe(AppSettings.current) private var settings
    @State private var draft = QuickAddDraft()
    @State private var added = 0
    @State private var unitChosen = false
    @FocusState private var focused: Bool

    var body: some View {
        Form {
            ThemedSection("Energy", footer: "Macro sum is \(Int(draft.macroSum.rounded())) \(draft.unit == .kj ? "kJ" : "kcal")") {
                HStack {
                    TextField("Energy", text: $draft.energy)
                        .keyboardType(.decimalPad)
                        .focused($focused)
                    Picker("Energy unit", selection: $draft.unit) {
                        Text("kcal").tag(NutritionSettings.EnergyUnit.kcal)
                        Text("kJ").tag(NutritionSettings.EnergyUnit.kj)
                    }
                    .labelsHidden()
                    .fixedSize()
                }
            }
            ThemedSection {
                grams("Protein", $draft.protein)
                grams("Fat", $draft.fat)
                grams("Carbs", $draft.carbs)
                grams("Alcohol", $draft.alcohol)
            }
            ThemedSection("Name") {
                TextField("Quick Add", text: $draft.name)
            }
        }
        .themedList()
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom) {
            HStack(spacing: 10) {
                Button {
                    guard let portion = draft.portion else { return }
                    session.add(LoggerPick(portion))
                    added += 1
                    draft = QuickAddDraft(unit: draft.unit)
                } label: {
                    Text("Quick Add")
                }
                .secondaryPill()
                .disabled(draft.portion == nil)
                .sensoryFeedback(.success, trigger: added)
                LogFoodsButton(session: session, prepare: {
                    if let portion = draft.portion { session.add(LoggerPick(portion)) }
                }, hasPending: draft.portion != nil)
                .buttonSizing(.flexible)
                .controlSize(.large)
            }
            .padding(.horizontal, Theme.margin)
            .padding(.bottom, 8)
        }
        .onAppear {
            guard !unitChosen else { return }
            unitChosen = true
            draft.unit = settings.nutrition.energyUnit
            focused = true
        }
    }

    private func grams(_ title: String, _ text: Binding<String>) -> some View {
        LabeledContent(title) {
            HStack(spacing: 4) {
                TextField("0", text: text)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                Text("g").foregroundStyle(Theme.textSecondary)
            }
        }
    }
}
