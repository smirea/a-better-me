import SwiftUI

/// The filterable, category-grouped exercise list shared by the picker and More > Exercises. The owner of the
/// navigation stack attaches `.searchable` and passes its text in as `query`.
struct ExerciseBrowser<Header: View, Trailing: View>: View {
    let exercises: [Exercise]
    @Binding var filter: ExerciseFilter
    let query: String
    var subtitle: (Exercise) -> String? = { _ in nil }
    let onSelect: (Exercise) -> Void
    @ViewBuilder var header: Header
    @ViewBuilder var trailing: (Exercise) -> Trailing

    @Environment(ExerciseCatalog.self) private var catalog
    @Observe(GymProfile.all) private var gyms
    @State private var expanded: Set<ExerciseCategory> = []
    private static var collapsedCount: Int { 5 }

    var body: some View {
        let search = ExerciseSearch(query)
        let gym = filter.gymID.flatMap { id in gyms.first { $0.id == id } }
        let availability = gym.map { GymAvailability(gym: $0, equipment: catalog.equipment) }
        let groups = ExerciseGroup.grouping(exercises.filter {
            filter.matches($0) && search.matches($0) && availability?.isAvailable($0) != false
        })
        List {
            if groups.isEmpty {
                Text("No Results")
                    .font(AppFont.medium(15))
                    .foregroundStyle(Theme.textSecondary)
                    .listRowBackground(Theme.surface)
            }
            ForEach(groups) { group in
                let isExpanded = expanded.contains(group.category)
                let hidden = group.exercises.count - Self.collapsedCount
                Section {
                    ForEach(isExpanded ? group.exercises : Array(group.exercises.prefix(Self.collapsedCount))) { exercise in
                        Button { onSelect(exercise) } label: {
                            LibraryExerciseRow(exercise: exercise, search: search, subtitle: subtitle(exercise)) { trailing(exercise) }
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("exercise-\(exercise.name)")
                    }
                } header: {
                    HStack {
                        Text(group.category.displayName).font(AppFont.headline(15)).foregroundStyle(Theme.textPrimary)
                        Spacer()
                        if hidden > 0 {
                            Button(isExpanded ? "See Less" : "See \(hidden) More") {
                                if isExpanded { expanded.remove(group.category) } else { expanded.insert(group.category) }
                            }
                            .font(AppFont.medium(13))
                            .underline()
                            .foregroundStyle(Theme.textPrimary)
                        }
                    }
                    .textCase(nil)
                }
                .listRowBackground(Theme.background)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .scrollDismissesKeyboard(.immediately)
        .safeAreaBar(edge: .top) {
            VStack(alignment: .leading, spacing: 10) {
                header
                ExerciseFilterBar(filter: $filter, exercises: exercises, gyms: gyms, availability: availability)
                MuscleFilterRow(selection: $filter.muscle)
            }
            .padding(.bottom, 6)
        }
    }
}

extension ExerciseBrowser where Header == EmptyView {
    init(
        exercises: [Exercise],
        filter: Binding<ExerciseFilter>,
        query: String,
        subtitle: @escaping (Exercise) -> String? = { _ in nil },
        onSelect: @escaping (Exercise) -> Void,
        @ViewBuilder trailing: @escaping (Exercise) -> Trailing
    ) {
        self.init(
            exercises: exercises, filter: filter, query: query, subtitle: subtitle, onSelect: onSelect,
            header: { EmptyView() }, trailing: trailing
        )
    }
}

/// Reset, Gym, Type, Laterality, Resistance, Support, and Range of Motion.
struct ExerciseFilterBar: View {
    @Binding var filter: ExerciseFilter
    let exercises: [Exercise]
    let gyms: [GymProfile]
    /// The chosen gym's, when it still exists.
    let availability: GymAvailability?
    @Environment(ExerciseCatalog.self) private var catalog
    @State private var equipmentSheet: EquipmentRole?
    @State private var managingGyms = false

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                if filter.isActive {
                    Button("Reset Filters", systemImage: "arrow.counterclockwise") { filter = ExerciseFilter(gymID: filter.gymID) }
                        .labelStyle(.iconOnly)
                        .font(AppFont.medium(13))
                        .foregroundStyle(Theme.textPrimary)
                        .frame(width: 32, height: 32)
                        .background(Theme.surfaceRaised, in: .circle)
                }
                gymMenu
                Menu {
                    Picker("Type", selection: $filter.type) {
                        Text("Any").tag(RestCategory?.none)
                        ForEach(RestCategory.allCases) { Text($0.displayName).tag(Optional($0)) }
                    }
                } label: {
                    FilterChipLabel(title: filter.type?.displayName ?? "Type", systemImage: "square.stack.3d.up", isActive: filter.type != nil)
                }
                Menu {
                    Picker("Laterality", selection: $filter.laterality) {
                        Text("Any").tag(Laterality?.none)
                        ForEach(Laterality.allCases, id: \.self) { Text($0.displayName).tag(Optional($0)) }
                    }
                } label: {
                    FilterChipLabel(
                        title: filter.laterality?.displayName ?? "Laterality",
                        systemImage: "rectangle.lefthalf.filled",
                        isActive: filter.laterality != nil
                    )
                }
                ForEach(EquipmentRole.allCases) { role in
                    let selected = filter[keyPath: role.filterKey]
                    Button { equipmentSheet = role } label: {
                        FilterChipLabel(
                            title: selected.flatMap { catalog.equipment[$0.id]?.name } ?? role.title,
                            systemImage: role.systemImage,
                            isActive: selected != nil
                        )
                    }
                }
                Menu {
                    Picker("Minimum", selection: rangeBound(\.lowerBound)) {
                        ForEach(ExerciseFilter.fullRange, id: \.self) { Text("At least \($0)").tag($0) }
                    }
                    Picker("Maximum", selection: rangeBound(\.upperBound)) {
                        ForEach(ExerciseFilter.fullRange, id: \.self) { Text("At most \($0)").tag($0) }
                    }
                } label: {
                    let range = filter.rangeOfMotion
                    FilterChipLabel(
                        title: range == ExerciseFilter.fullRange ? "Range of Motion" : "ROM \(range.lowerBound)-\(range.upperBound)",
                        systemImage: "arrow.left.and.right",
                        isActive: range != ExerciseFilter.fullRange
                    )
                }
            }
            .padding(.horizontal)
        }
        .scrollIndicators(.hidden)
        .sheet(item: $equipmentSheet) { role in
            EquipmentPickerSheet(
                title: role.title,
                equipmentIDs: Set(exercises.flatMap { $0[keyPath: role.optionsKey].joined() }),
                selection: $filter[dynamicMember: role.filterKey],
                availability: availability
            )
        }
        .sheet(isPresented: $managingGyms) {
            NavigationStack {
                GymProfilesView()
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Close", systemImage: "xmark") { managingGyms = false }
                        }
                    }
            }
            .tint(Theme.textPrimary)
        }
    }

    private var gymMenu: some View {
        let gym = availability == nil ? nil : gyms.first { $0.id == filter.gymID }
        return Menu {
            Section {
                gymToggle(nil) { Text("Any Gym") }
                ForEach(gyms) { gym in
                    gymToggle(gym.id) { Label(gym.name, systemImage: gym.icon) }
                }
            } header: {
                Text("Gym Options")
                Text("Impacts exercise selection")
            }
            Button("Manage Gym Profiles", systemImage: "gearshape") { managingGyms = true }
        } label: {
            FilterChipLabel(title: gym?.name ?? "Gym", systemImage: "building.2", isActive: gym != nil)
        }
    }

    /// A menu toggle rather than an inline picker, because a picker drops the section's title.
    private func gymToggle(_ id: UUID?, @ViewBuilder label: () -> some View) -> some View {
        Toggle(isOn: Binding(get: { filter.gymID == id }, set: { if $0 { filter.gymID = id } }), label: label)
    }

    /// Moving one end past the other drags the other along, so the range never inverts.
    private func rangeBound(_ end: KeyPath<ClosedRange<Int>, Int>) -> Binding<Int> {
        Binding {
            filter.rangeOfMotion[keyPath: end]
        } set: { value in
            let range = filter.rangeOfMotion
            filter.rangeOfMotion = end == \.lowerBound
                ? value...max(value, range.upperBound)
                : min(value, range.lowerBound)...value
        }
    }
}

enum EquipmentRole: String, CaseIterable, Identifiable {
    case resistance, support

    var id: String { rawValue }
    var title: String { rawValue.capitalized }
    var systemImage: String { self == .resistance ? "scalemass" : "chair.lounge" }

    var filterKey: WritableKeyPath<ExerciseFilter, EquipmentChoice?> {
        self == .resistance ? \.resistance : \.support
    }

    var optionsKey: KeyPath<Exercise, [[String]]> {
        self == .resistance ? \.resistanceEquipmentIDs : \.supportEquipmentIDs
    }
}

struct EquipmentPickerSheet: View {
    let title: String
    let equipmentIDs: Set<String>
    @Binding var selection: EquipmentChoice?
    /// Marks items the filter's gym lacks, which can still be chosen.
    var availability: GymAvailability? = nil
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    var body: some View {
        let plurals = Dictionary(catalog.equipment.values.compactMap { item in item.pluralOf.map { ($0, item.id) } }) { first, _ in first }
        let listed = Set(equipmentIDs.map { plurals[$0] ?? $0 })
        let items = listed.compactMap { catalog.equipment[$0] }
            .filter { query.isEmpty || $0.name.localizedStandardContains(query) }
        let sections = Dictionary(grouping: items, by: \.category)
            .sorted { EquipmentCategoryOrder.index($0.key) < EquipmentCategoryOrder.index($1.key) }
        NavigationStack {
            List {
                ForEach(sections, id: \.key) { category, equipment in
                    Section(category) {
                        ForEach(equipment.sorted { $0.name < $1.name }) { item in
                            let isSelected = selection?.id == item.id
                            Button {
                                selection = isSelected ? nil : EquipmentChoice(id: item.id, matching: Set([item.id, item.pluralOf].compactMap(\.self)))
                                dismiss()
                            } label: {
                                HStack(spacing: 14) {
                                    EquipmentImage(equipmentID: item.id).frame(width: 32, height: 32)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(item.name).font(AppFont.medium(15)).foregroundStyle(Theme.textPrimary)
                                        if availability?.provides(item.id) == false {
                                            Text("Not available in this gym").font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                                        }
                                    }
                                    Spacer()
                                    Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                                        .foregroundStyle(isSelected ? Theme.textPrimary : Theme.textTertiary)
                                }
                            }
                            .listRowBackground(Theme.surface)
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Filter equipment by name")
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
        }
        .tint(Theme.textPrimary)
    }
}

struct MuscleFilterRow: View {
    @Binding var selection: Muscle?

    /// Hip flexors have no figure in the reference app, so they are not offered.
    static let order: [Muscle] = [
        .chest, .quads, .upperBack, .glutes, .lats, .hamstrings, .biceps, .triceps, .frontDelts, .sideDelts, .rearDelts,
        .abs, .calves, .forearms, .upperTraps, .lowerBack, .obliques, .adductors, .abductors, .tibs, .serratus, .neck,
    ]

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(Self.order) { muscle in
                    Button { selection = selection == muscle ? nil : muscle } label: {
                        VStack(spacing: 4) {
                            MuscleTile(muscle: muscle)
                                .frame(width: 48, height: 48)
                                .background(Theme.surface)
                                .clipShape(.rect(cornerRadius: 8))
                                .overlay {
                                    RoundedRectangle(cornerRadius: 8)
                                        .strokeBorder(selection == muscle ? Theme.textPrimary : .clear, lineWidth: 2)
                                }
                            Text(muscle.displayName)
                                .font(AppFont.caption(10))
                                .foregroundStyle(selection == muscle ? Theme.textPrimary : Theme.textSecondary)
                                .lineLimit(1)
                        }
                        .frame(width: 56)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(muscle.displayName)
                    .accessibilityAddTraits(selection == muscle ? .isSelected : [])
                }
            }
            .padding(.horizontal)
        }
        .scrollIndicators(.hidden)
    }
}
