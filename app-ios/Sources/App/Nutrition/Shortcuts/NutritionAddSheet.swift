import SwiftUI

/// A Nutrition "+" shortcut (research spec §2, `nav-03-choose-shortcuts.jpg`). AI, Describe, Photos, and Metrics are not
/// built, and Edit Day belongs to the Dashboard's data manager, so they are not offered.
enum NutritionShortcut: String, Codable, CaseIterable, Sendable {
    case yourFoods, search, barcode, quickAdd, recipes, favorites, weight

    static let defaults: [NutritionShortcut] = [.yourFoods, .search, .barcode, .quickAdd, .recipes, .favorites, .weight]
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
        case .weight: "scalemass.fill"
        }
    }

    /// Where a logging shortcut opens the logger; nil for Weight.
    var logger: LoggerStart? {
        switch self {
        case .yourFoods: LoggerStart(tab: .library, library: .foods)
        case .search: LoggerStart(tab: .search)
        case .barcode: LoggerStart(tab: .scan)
        case .quickAdd: LoggerStart(tab: .quickAdd)
        case .recipes: LoggerStart(tab: .library, library: .recipes)
        case .favorites: LoggerStart(tab: .library, library: .favorites)
        case .weight: nil
        }
    }
}

/// The tab bar's "+" in Nutrition mode (`nav-01-plus-shortcuts.jpg`): four round shortcuts and the rest as rows. A
/// logging shortcut turns this sheet into the full-height logger instead of stacking a second sheet on it.
struct NutritionAddSheet: View {
    @Observe(AppSettings.current) private var settings
    @Environment(\.dismiss) private var dismiss
    @State private var logger: LoggerStart?
    @State private var loggingWeight = false
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
            ScrollView {
                VStack(spacing: 16) {
                    HStack(alignment: .top) {
                        ForEach(top, id: \.self) { round($0) }
                    }
                    .padding(.top, 8)
                    VStack(spacing: 0) {
                        ForEach(rows, id: \.self) { shortcut in
                            if shortcut != rows.first { Divider().overlay(Theme.separator).padding(.leading, 44) }
                            row(shortcut)
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 8)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 }
            }
            .scrollBounceBehavior(.basedOnSize)
            .background(Theme.surface)
            .navigationTitle("Shortcuts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Customize Shortcuts", systemImage: "slider.horizontal.3") { customizing = true }
                }
            }
        }
        .presentationDetents([.height(contentHeight + 76)])
        .sheet(isPresented: $loggingWeight) { BodyWeightLogSheet() }
        .sheet(isPresented: $customizing) { CustomizeNutritionShortcuts() }
    }

    private func perform(_ shortcut: NutritionShortcut) {
        if let start = shortcut.logger {
            logger = start
        } else {
            loggingWeight = true
        }
    }

    private func round(_ shortcut: NutritionShortcut) -> some View {
        Button { perform(shortcut) } label: {
            VStack(spacing: 8) {
                Image(systemName: shortcut.systemImage)
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 44, height: 44)
                    .background(Theme.surfaceRaised, in: .circle)
                Text(shortcut.title).font(AppFont.medium(13))
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func row(_ shortcut: NutritionShortcut) -> some View {
        Button { perform(shortcut) } label: {
            HStack(spacing: 18) {
                Image(systemName: shortcut.systemImage).frame(width: 26)
                Text(shortcut.title).font(AppFont.headline())
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary)
            }
            .padding(.vertical, 16)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
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
            .navigationTitle("Customize Shortcuts")
            .navigationBarTitleDisplayMode(.inline)
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
