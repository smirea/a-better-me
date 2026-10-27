import SwiftUI

/// A Nutrition "+" shortcut (research spec §2, `nav-03-choose-shortcuts.jpg`). AI, Describe, Photos, and Metrics are not
/// built, so they are not offered.
enum NutritionShortcut: String, Codable, CaseIterable, Sendable, ShortcutItem {
    case yourFoods, search, barcode, quickAdd, recipes, favorites, editDay, weight

    static let defaults: [NutritionShortcut] = [.yourFoods, .search, .barcode, .quickAdd, .recipes, .favorites, .editDay, .weight]
    /// The first four are the round buttons, as MacroFactor tags them "Top Shortcut".
    static let topCount = 4

    var title: String {
        switch self {
        case .yourFoods: "Your Foods"
        case .search: "Search"
        case .barcode: "Barcode"
        case .quickAdd: "Quick Add"
        case .recipes: "Recipes"
        case .favorites: "Favorites"
        case .editDay: "Edit Day"
        case .weight: "Weight"
        }
    }

    var detail: String {
        switch self {
        case .yourFoods: "Browse custom foods you created"
        case .search: "Search foods to log"
        case .barcode: "Scan a barcode to log"
        case .quickAdd: "Log calories and macros"
        case .recipes: "Browse and log your recipes"
        case .favorites: "Log a saved serving"
        case .editDay: "Edit today's nutrition totals"
        case .weight: "Add scale weight and body fat %"
        }
    }

    var systemImage: String {
        switch self {
        case .yourFoods: "fork.knife"
        case .search: "magnifyingglass"
        case .barcode: "barcode.viewfinder"
        case .quickAdd: "bolt.fill"
        case .recipes: "frying.pan"
        case .favorites: "heart.fill"
        case .editDay: "square.and.pencil"
        case .weight: "scalemass.fill"
        }
    }

    /// Where a logging shortcut opens the logger; nil for Edit Day and Weight.
    var logger: LoggerStart? {
        switch self {
        case .yourFoods: LoggerStart(tab: .library, library: .foods)
        case .search: LoggerStart(tab: .search)
        case .barcode: LoggerStart(tab: .scan)
        case .quickAdd: LoggerStart(tab: .quickAdd)
        case .recipes: LoggerStart(tab: .library, library: .recipes)
        case .favorites: LoggerStart(tab: .library, library: .favorites)
        case .editDay, .weight: nil
        }
    }
}

/// The tab bar's "+" in Nutrition mode (`nav-01-plus-shortcuts.jpg`): four round shortcuts and the rest as rows. A
/// logging shortcut turns this sheet into the full-height logger instead of stacking a second sheet on it.
struct NutritionAddSheet: View {
    @Observe(AppSettings.current) private var settings
    @State private var logger: LoggerStart?
    @State private var loggingWeight = false
    @State private var editingDay = false
    @State private var customizing = false
    @State private var contentHeight: CGFloat = 300

    var body: some View {
        if let logger {
            LoggerSheet(start: logger)
        } else {
            shortcuts
        }
    }

    private var shortcuts: some View {
        let all = settings.nutrition.shortcuts
        let top = Array(all.prefix(NutritionShortcut.topCount))
        let rows = Array(all.dropFirst(NutritionShortcut.topCount))
        return NavigationStack {
            ShortcutsPanel(top: top, rows: rows, height: $contentHeight, perform: perform) { customizing = true }
        }
        .presentationDetents([.shortcutsFitted(contentHeight)])
        .sheet(isPresented: $loggingWeight) { BodyWeightLogSheet() }
        .sheet(isPresented: $editingDay) { EditDaySheet() }
        .sheet(isPresented: $customizing) { CustomizeNutritionShortcuts() }
    }

    private func perform(_ shortcut: NutritionShortcut) {
        switch shortcut {
        case .editDay: editingDay = true
        case .weight: loggingWeight = true
        default: logger = shortcut.logger
        }
    }
}

/// Edit Day: the Dashboard's Nutrition Data Manager entry for today, once the log it reads is loaded off the main actor.
private struct EditDaySheet: View {
    @Environment(LocalStore.self) private var store
    @State private var log: [NutritionLogDay]?

    var body: some View {
        Group {
            if let log {
                NutritionDayEntrySheet(day: .today, log: log)
            } else {
                ProgressView()
            }
        }
        .task {
            do {
                log = try await store.database.pool.read(NutritionLogDay.all.fetch)
            } catch {
                LocalStore.log.error("Edit Day could not read the log: \(String(describing: error))")
                log = []
            }
        }
    }
}

/// The sliders button: the shortcuts' order, with the first four as the round buttons, and which ones show.
private struct CustomizeNutritionShortcuts: View {
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Observe(AppSettings.current) private var settings

    var body: some View {
        let shown = settings.nutrition.shortcuts
        NavigationStack {
            List {
                Section {
                    ForEach(Array(shown.enumerated()), id: \.element) { index, shortcut in
                        toggle(shortcut, on: true, top: index < NutritionShortcut.topCount)
                    }
                    .onMove { from, to in
                        store.updateSettings { $0.nutrition.shortcuts.move(fromOffsets: from, toOffset: to) }
                    }
                    ForEach(NutritionShortcut.allCases.filter { !shown.contains($0) }, id: \.self) { shortcut in
                        toggle(shortcut, on: false, top: false).moveDisabled(true)
                    }
                } footer: {
                    Text("The first four are the round buttons at the top.")
                }
                Section {
                    Button("Reset to App Defaults", role: .destructive) {
                        store.updateSettings { $0.nutrition.shortcuts = NutritionShortcut.defaults }
                    }
                }
            }
            .environment(\.editMode, .constant(.active))
            .themedList()
            .detailTitle("Customize Shortcuts")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", systemImage: "checkmark") { dismiss() }
                }
            }
        }
    }

    private func toggle(_ shortcut: NutritionShortcut, on: Bool, top: Bool) -> some View {
        Toggle(isOn: Binding(get: { on }, set: { show in
            store.updateSettings { settings in
                settings.nutrition.shortcuts.removeAll { $0 == shortcut }
                if show { settings.nutrition.shortcuts.append(shortcut) }
            }
        })) {
            Label {
                VStack(alignment: .leading, spacing: 2) {
                    Text(shortcut.title)
                    Text(top ? "Top Shortcut" : shortcut.detail).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                }
            } icon: {
                Image(systemName: shortcut.systemImage).foregroundStyle(Theme.textPrimary)
            }
        }
        .tint(Theme.accent)
    }
}
