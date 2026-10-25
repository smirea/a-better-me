import SwiftUI

/// More > Gym Profiles, and the picker's Manage Gym Profiles. Push it inside a navigation stack.
struct GymProfilesView: View {
    @Environment(LocalStore.self) private var store
    @Observe(GymProfile.all) private var gyms
    @Observe(GymProfile.defaultGym) private var defaultGym
    @State private var editing: UUID?
    @State private var adding = false

    var body: some View {
        List {
            Section {
                ForEach(gyms) { gym in
                    let isDefault = gym.id == defaultGym?.id
                    GymRow(gym: gym, isDefault: isDefault) { editing = gym.id }
                        .listRowBackground(Theme.background)
                        .swipeActions(edge: .leading) {
                            if !isDefault {
                                Button("Set as Default", systemImage: "star") { store.setDefaultGym(gym.id) }
                                    .tint(Theme.accent)
                            }
                        }
                        .contextMenu {
                            Button("Set as Default", systemImage: "star") { store.setDefaultGym(gym.id) }
                                .disabled(isDefault)
                            Button("Edit", systemImage: "pencil") { editing = gym.id }
                        }
                }
            } header: {
                SectionTitle(gyms.count == 1 ? "1 Gym" : "\(gyms.count) Gyms").textCase(nil)
            }
        }
        .listStyle(.plain)
        .themedList()
        .navigationTitle("Gym Profiles")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            Button("Add New Gym Profile") { adding = true }
                .secondaryPill()
                .padding(.horizontal)
        }
        .sheet(isPresented: $adding) {
            NewGymSheet(makesDefault: gyms.isEmpty) { editing = $0 }
        }
        .navigationDestination(item: $editing) { GymProfileEditor(gymID: $0) }
    }
}

private struct GymRow: View {
    let gym: GymProfile
    let isDefault: Bool
    let onEdit: () -> Void

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: gym.icon)
                .font(.system(size: 18))
                .foregroundStyle(Theme.textPrimary)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(gym.name).font(AppFont.headline(15)).foregroundStyle(Theme.textPrimary)
                Text(gym.equipment.count == 1 ? "1 piece of equipment" : "\(gym.equipment.count) pieces of equipment")
                    .font(AppFont.caption(13))
                    .foregroundStyle(Theme.textSecondary)
                if isDefault {
                    Text("Default").font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
                }
            }
            Spacer()
            Button("Edit \(gym.name)", systemImage: "pencil", action: onEdit)
                .labelStyle(.iconOnly)
                .font(AppFont.headline(13))
                .foregroundStyle(Theme.textPrimary)
                .frame(width: 30, height: 30)
                .background(Theme.surfaceRaised, in: .circle)
                .buttonStyle(.plain)
        }
        .padding(.vertical, 6)
    }
}

/// Add New Gym Profile: a gym type, whose preset selects the starting equipment, and a name.
private struct NewGymSheet: View {
    let makesDefault: Bool
    let onCreate: (UUID) -> Void
    @Environment(LocalStore.self) private var store
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(\.dismiss) private var dismiss
    @Observe(AppSettings.current) private var settings
    @State private var name = "Your Gym"
    @State private var template = GymTemplate.commercial

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("Gym name", text: $name)
                        .font(AppFont.medium(16))
                        .listRowBackground(Theme.surface)
                } header: {
                    SectionTitle("Name").textCase(nil)
                }
                Section {
                    ForEach(GymTemplate.allCases) { option in
                        Button { template = option } label: {
                            HStack(spacing: 14) {
                                Image(systemName: option.icon).font(.system(size: 18)).frame(width: 28)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(option.title).font(AppFont.headline(15))
                                    Text(option.summary).font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
                                }
                                Spacer()
                                Image(systemName: template == option ? "largecircle.fill.circle" : "circle")
                                    .foregroundStyle(template == option ? Theme.textPrimary : Theme.textTertiary)
                            }
                            .foregroundStyle(Theme.textPrimary)
                            .contentShape(.rect)
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(template == option ? .isSelected : [])
                        .listRowBackground(Theme.surface)
                    }
                } header: {
                    SectionTitle("Gym Type").textCase(nil)
                }
            }
            .themedList()
            .navigationTitle("New Gym Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                Button("Create Gym Profile", action: create)
                    .primaryPill()
                    .padding(.horizontal)
            }
        }
    }

    private func create() {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        var gym = GymProfile(name: trimmed.isEmpty ? "Your Gym" : trimmed, icon: template.icon, equipment: template.equipment(from: catalog.equipment, unit: settings.weightUnit))
        gym.isDefault = makesDefault
        store.insert(gym)
        dismiss()
        onCreate(gym.id)
    }
}
