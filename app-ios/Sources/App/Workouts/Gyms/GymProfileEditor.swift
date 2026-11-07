import Feedback
import SwiftUI

/// One gym's name, icon, and equipment with its weights. Every change writes straight to the profile.
struct GymProfileEditor: View {
    let gymID: UUID
    @Environment(LocalStore.self) private var store
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(\.dismiss) private var dismiss
    @Observe private var gym: GymProfile?
    @Observe(GymProfile.defaultGym) private var defaultGym
    @Observe(AppSettings.current) private var settings
    @State private var selectedOnly = false
    @State private var query = ""
    @State private var renaming = false
    @State private var confirmingRemove = false
    @State private var editingLoad: Equipment?

    init(gymID: UUID) {
        self.gymID = gymID
        _gym = Observe(GymProfile.one(gymID))
    }

    var body: some View {
        Group {
            if let gym {
                content(gym)
            } else {
                Theme.background.ignoresSafeArea()
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .feedback(self)
    }

    private func content(_ gym: GymProfile) -> some View {
        let sections = equipmentSections(gym)
        let isDefault = defaultGym?.id == gym.id
        return List {
            Section {
                SettingToggle(
                    title: "Include Bumper Plates", detail: bumperDetail(gym), systemImage: "circle.circle",
                    isOn: calculatorBinding(gym, \.includeBumperPlates)
                )
                SettingToggle(
                    title: "Utilize Mixed Unit Plates", detail: "Loads kg and lb plates together instead of only the plates in your unit",
                    systemImage: "scalemass", isOn: calculatorBinding(gym, \.allowMixedUnits)
                )
                SettingToggle(
                    title: "Offset Weight", detail: "Adds the ability to optionally offset the total weight targeted by the weight calculator",
                    systemImage: "plusminus", isOn: calculatorBinding(gym, \.offsetWeight)
                )
            } header: {
                SectionTitle("Plate Calculator").textCase(nil)
            }
            .listRowBackground(Theme.surface)
            Section {
                EmptyView()
            } header: {
                HStack {
                    SectionTitle("Equipment")
                    Spacer()
                    Picker("Show", selection: $selectedOnly) {
                        Text("Selected").tag(true)
                        Text("All").tag(false)
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 150)
                }
                .textCase(nil)
            }
            if sections.isEmpty {
                ContentUnavailableView.search(text: query)
                    .listRowBackground(Theme.background)
                    .listRowSeparator(.hidden)
            }
            ForEach(sections, id: \.category) { section in
                let anySelected = section.items.contains { gym.equipment[$0.id] != nil }
                Section {
                    ForEach(section.items) { item in
                        EquipmentRow(
                            item: item,
                            load: GymDefaults.effectiveLoad(item.id, in: gym, unit: settings.weightUnit),
                            isSelected: gym.equipment[item.id] != nil,
                            unit: settings.weightUnit,
                            onToggle: { setSelected([item.id], gym.equipment[item.id] == nil) },
                            onEditLoad: { editingLoad = item }
                        )
                    }
                    .listRowBackground(Theme.surface)
                } header: {
                    HStack {
                        Text(section.category).font(AppFont.headline(16)).foregroundStyle(Theme.textPrimary)
                        Spacer()
                        Button(anySelected ? "Deselect All" : "Select All") {
                            setSelected(section.items.map(\.id), !anySelected)
                        }
                        .font(AppFont.chip)
                        .underline()
                        .foregroundStyle(Theme.textPrimary)
                        .accessibilityLabel("\(anySelected ? "Deselect" : "Select") All \(section.category)")
                    }
                    .textCase(nil)
                }
            }
        }
        .themedList()
        .scrollDismissesKeyboard(.immediately)
        .navigationTitle(gym.name)
        .toolbarVisibility(.hidden, for: .tabBar)
        .safeAreaInset(edge: .bottom) { GlassSearchField(text: $query, prompt: "Filter equipment by name") }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu("Gym Options", systemImage: "ellipsis") {
                    Picker(selection: Binding(get: { gym.icon }, set: { icon in edit { $0.icon = icon } })) {
                        ForEach(Self.icons, id: \.symbol) { Label($0.name, systemImage: $0.symbol).tag($0.symbol) }
                    } label: {
                        Label("Icon", systemImage: gym.icon)
                    }
                    .pickerStyle(.menu)
                    Button("Rename", systemImage: "square.and.pencil") { renaming = true }
                    Button("Duplicate", systemImage: "plus.square.on.square") { duplicate(gym) }
                    Button("Set as Default", systemImage: "star") { store.setDefaultGym(gym.id) }
                        .disabled(isDefault)
                    Button("Delete Gym", systemImage: "trash", role: .destructive) { confirmingRemove = true }
                        .disabled(isDefault)
                }
            }
        }
        .nameAlert("Rename Gym", isPresented: $renaming, initial: gym.name, placeholder: "Gym name") { name in
            edit { $0.name = name }
        }
        .alert("Delete \(gym.name)?", isPresented: $confirmingRemove) {
            Button("Delete", role: .destructive) { delete(gym) }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Its equipment and weights are removed.")
        }
        .sheet(item: $editingLoad) { item in
            if let load = GymDefaults.effectiveLoad(item.id, in: gym, unit: settings.weightUnit) {
                EquipmentLoadEditor(equipment: item, load: load, unit: settings.weightUnit) { saved in
                    let id = item.id
                    edit { gym in
                        if saved != nil || gym.equipment[id] != nil { gym.equipment[id] = GymEquipment(load: saved) }
                    }
                }
            }
        }
    }

    private struct EquipmentSection {
        let category: String
        let items: [Equipment]
    }

    private func equipmentSections(_ gym: GymProfile) -> [EquipmentSection] {
        let search = ExerciseSearch(query)
        let items = GymCatalog(catalog.equipment).items.filter { item in
            (!selectedOnly || gym.equipment[item.id] != nil) && search.words.allSatisfy { item.name.localizedStandardContains($0) }
        }
        var sections: [EquipmentSection] = []
        for item in items {
            if sections.last?.category == item.category {
                sections[sections.count - 1] = EquipmentSection(category: item.category, items: sections[sections.count - 1].items + [item])
            } else {
                sections.append(EquipmentSection(category: item.category, items: [item]))
            }
        }
        return sections
    }

    private func edit(_ change: @escaping @Sendable (inout GymProfile) -> Void) {
        store.edit(GymProfile.self, id: gymID, change)
    }

    /// Selecting keeps an item's custom load; deselecting drops it with the key.
    private func setSelected(_ ids: [EquipmentID], _ selected: Bool) {
        edit { gym in
            for id in ids {
                if !selected {
                    gym.equipment[id] = nil
                } else if gym.equipment[id] == nil {
                    gym.equipment[id] = GymEquipment(load: nil)
                }
            }
        }
    }

    private func calculatorBinding(_ gym: GymProfile, _ path: WritableKeyPath<PlateCalculatorOptions, Bool> & Sendable) -> Binding<Bool> {
        let gymID = gym.id
        return Binding(
            get: { settings.workout.plateCalculator(for: gymID)[keyPath: path] },
            set: { value in store.updateSettings { $0.workout.plateCalculator[gymID.uuidString, default: PlateCalculatorOptions()][keyPath: path] = value } }
        )
    }

    private func bumperDetail(_ gym: GymProfile) -> String {
        guard gym.equipment[Loading.bumperPlatesID] != nil, let load = GymDefaults.effectiveLoad(Loading.bumperPlatesID, in: gym, unit: settings.weightUnit) else {
            return "No bumper plate weights available in this gym"
        }
        return "Available Bumper Plates: \(load.summary(in: settings.weightUnit))"
    }

    private func duplicate(_ gym: GymProfile) {
        let copy = GymProfile(name: "\(gym.name) Copy", icon: gym.icon, equipment: gym.equipment)
        store.insert(copy)
        if let options = settings.workout.plateCalculator[gym.id.uuidString] {
            store.updateSettings { $0.workout.plateCalculator[copy.id.uuidString] = options }
        }
    }

    private func delete(_ gym: GymProfile) {
        store.delete(GymProfile.self, id: gym.id)
        dismiss()
    }
}

private struct EquipmentRow: View {
    let item: Equipment
    let load: EquipmentLoad?
    let isSelected: Bool
    let unit: WeightUnit
    let onToggle: () -> Void
    let onEditLoad: () -> Void

    var body: some View {
        HStack(spacing: 14) {
            EquipmentImage(equipmentID: item.id).frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 3) {
                Text(item.name).font(AppFont.rowTitle).foregroundStyle(Theme.textPrimary)
                if let load {
                    Text(load.summary(in: unit))
                        .font(AppFont.caption(13))
                        .foregroundStyle(Theme.textSecondary)
                        .lineLimit(2)
                    Button(load.editTitle, action: onEditLoad)
                        .font(AppFont.medium(13))
                        .underline()
                        .foregroundStyle(Theme.textPrimary)
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(load.editTitle) \(item.name)")
                }
            }
            Spacer()
            Button(isSelected ? "Deselect \(item.name)" : "Select \(item.name)", systemImage: isSelected ? "checkmark.square.fill" : "square", action: onToggle)
                .labelStyle(.iconOnly)
                .font(.system(size: 22))
                .foregroundStyle(isSelected ? Theme.textPrimary : Theme.textTertiary)
                .frame(width: 36, height: 36)
                .contentShape(.rect)
                .buttonStyle(.plain)
                .accessibilityAddTraits(isSelected ? .isSelected : [])
        }
        .padding(.vertical, 4)
        .feedback(self)
    }
}

extension GymProfileEditor {
    static let icons: [(symbol: String, name: String)] = [
        ("house.fill", "House"), ("building.2.fill", "Buildings"), ("building.columns.fill", "Columns"),
        ("dumbbell.fill", "Dumbbell"), ("figure.strengthtraining.traditional", "Lifter"), ("figure.run", "Runner"),
        ("tent.fill", "Tent"), ("sun.max.fill", "Sun"), ("briefcase.fill", "Briefcase"), ("airplane", "Airplane"),
        ("mountain.2.fill", "Mountains"), ("star.fill", "Star"),
    ]
}
