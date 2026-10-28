import SwiftUI

/// Search (`log-02-search-results.jpg`): the hour's Picks and Latest when the field is empty, otherwise the groups
/// `FoodSearch` returns, in MacroFactor's compact rows, with the field and Log Foods at the bottom.
struct SearchTab: View {
    let session: LoggerSession
    let open: (LoggerPick) -> Void
    @Observe(AppSettings.current) private var settings
    @State private var text = ""
    @FocusState private var focused: Bool

    var body: some View {
        let terms = FoodText.terms(session.query)
        let picks = session.picks
        List {
            if session.query.isEmpty {
                if let hour = session.picksHour, !picks.isEmpty {
                    ThemedSection("\(NutritionFormat.hour(hour)) Picks") { rows(picks, terms, picksHour: hour) }
                }
                ThemedSection("Latest") { rows(session.results, terms) }
            } else {
                ForEach(groups, id: \.0) { group, results in
                    ThemedSection(group.title) { rows(results, terms) }
                }
                if session.isSearchingBranded {
                    ThemedSection(FoodSearchGroup.branded.title) {
                        ProgressView().frame(maxWidth: .infinity).listRowBackground(Color.clear)
                    }
                }
            }
        }
        .listStyle(.plain)
        .listSectionSpacing(0)
        .environment(\.defaultMinListRowHeight, 0)
        .scrollDismissesKeyboard(.immediately)
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
            LoggerBottomBar(session: session, text: $text) {
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

    /// Swiping a row right adds it to the plate, MacroFactor's Multi-Add; swiping a Pick left takes it out of that
    /// hour's Picks.
    private func rows(_ results: [FoodSearchResult], _ terms: [String], picksHour: Int? = nil) -> some View {
        ForEach(results) { result in
            HStack(spacing: 4) {
                Button {
                    focused = false
                    open(LoggerPick(result))
                } label: {
                    FoodRow(food: result.portion.food, serving: result.portion.serving, matching: terms)
                }
                .buttonStyle(.plain)
                AddToPlateButton(food: result.portion.food) { session.add(LoggerPick(result)) }
            }
            .listRowInsets(EdgeInsets(top: 2, leading: Theme.margin, bottom: 2, trailing: 8))
            .listRowBackground(Color.clear)
            .swipeActions(edge: .leading) {
                Button("Add to Plate", systemImage: "plus") { session.add(LoggerPick(result)) }.tint(Theme.accent)
            }
            .swipeActions(edge: .trailing) {
                if let picksHour {
                    Button("Remove from Picks", systemImage: "trash", role: .destructive) {
                        Task { await session.hidePick(result.portion.food, hour: picksHour) }
                    }
                    .tint(Theme.destructive)
                }
            }
        }
    }
}

extension FoodSearchGroup {
    var title: String {
        switch self {
        case .picks: "Picks"
        case .history: "From History"
        case .favorites: "Favorites"
        case .custom: "Your Foods"
        case .recipes: "Recipes"
        case .common: "Common"
        case .branded: "Branded"
        }
    }
}

/// A tab's bottom bar: its field in a glass capsule, with a clear button while `text` holds something, and Log Foods.
struct LoggerBottomBar<Field: View>: View {
    let session: LoggerSession
    var text: Binding<String>?
    @ViewBuilder let field: () -> Field

    var body: some View {
        GlassEffectContainer {
            HStack(spacing: 10) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").foregroundStyle(Theme.textSecondary)
                    field()
                    if let text, !text.wrappedValue.isEmpty {
                        Button("Clear search", systemImage: "xmark.circle.fill") { text.wrappedValue = "" }
                            .labelStyle(.iconOnly)
                            .buttonStyle(.plain)
                            .foregroundStyle(Theme.textSecondary)
                            .frame(width: 44, height: 44)
                            .contentShape(.rect)
                    }
                }
                .padding(.leading, 16)
                .padding(.trailing, text?.wrappedValue.isEmpty == false ? 2 : 16)
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
/// and an optional name. Quick Add puts it on the plate as one serving; Log Foods logs the plate with it. The banner
/// counts what is typed, as it counts a food detail's amount. While the keyboard is up its bar walks the fields and
/// carries Quick Add, and the bottom buttons step aside so they never cover a field.
struct QuickAddTab: View {
    let session: LoggerSession
    @Observe(AppSettings.current) private var settings
    @State private var draft = QuickAddDraft()
    @State private var added = 0
    @State private var unitChosen = false
    @FocusState private var focus: QuickAddDraft.Field?

    var body: some View {
        Form {
            ThemedSection("Energy", footer: "Macro sum is \(Int(draft.macroSum.rounded())) \(draft.unit == .kj ? "kJ" : "kcal")") {
                HStack {
                    TextField("Energy", text: $draft.energy)
                        .keyboardType(.decimalPad)
                        .focused($focus, equals: .energy)
                    Picker("Energy unit", selection: $draft.unit) {
                        Text("kcal").tag(NutritionSettings.EnergyUnit.kcal)
                        Text("kJ").tag(NutritionSettings.EnergyUnit.kj)
                    }
                    .labelsHidden()
                    .fixedSize()
                }
            }
            ThemedSection {
                grams("Protein", $draft.protein, .protein)
                grams("Fat", $draft.fat, .fat)
                grams("Carbs", $draft.carbs, .carbs)
                grams("Alcohol", $draft.alcohol, .alcohol)
            }
            ThemedSection("Name") {
                TextField("Quick Add", text: $draft.name)
                    .focused($focus, equals: .name)
                    .submitLabel(.done)
            }
        }
        .themedList()
        .scrollDismissesKeyboard(.interactively)
        .focusToolbar(QuickAddDraft.focusOrder, focus: $focus) {
            Button("Quick Add", action: quickAdd)
                .disabled(draft.portion == nil)
        }
        .safeAreaInset(edge: .bottom) {
            if focus == nil {
                HStack(spacing: 10) {
                    Button("Quick Add", action: quickAdd)
                        .secondaryPill()
                        .disabled(draft.portion == nil)
                    LogFoodsButton(session: session, prepare: {
                        if let portion = draft.portion { session.add(LoggerPick(portion)) }
                    }, hasPending: draft.portion != nil)
                    .buttonSizing(.flexible)
                    .controlSize(.large)
                }
                .padding(.horizontal, Theme.margin)
                .padding(.bottom, 8)
            }
        }
        .sensoryFeedback(.success, trigger: added)
        .onChange(of: draft) { session.pending = draft.portion }
        .onAppear {
            session.pending = draft.portion
            guard !unitChosen else { return }
            unitChosen = true
            draft.unit = settings.nutrition.energyUnit
            focus = .energy
        }
        .onDisappear { session.pending = nil }
    }

    private func quickAdd() {
        guard let portion = draft.portion else { return }
        session.add(LoggerPick(portion))
        added += 1
        draft = QuickAddDraft(unit: draft.unit)
        focus = nil
    }

    private func grams(_ title: String, _ text: Binding<String>, _ field: QuickAddDraft.Field) -> some View {
        LabeledContent(title) {
            HStack(spacing: 4) {
                TextField("0", text: text)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .focused($focus, equals: field)
                Text("g").foregroundStyle(Theme.textSecondary)
            }
        }
    }
}
