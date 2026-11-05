import Feedback
import SwiftUI

/// Settings > Gym Profiles, and the picker's Manage Gym Profiles. Push it inside a navigation stack.
struct GymProfilesView: View {
    @Environment(LocalStore.self) private var store
    @Observe(GymProfile.all) private var gyms
    @Observe(GymProfile.defaultGym) private var defaultGym
    @State private var editing: UUID?
    @State private var adding = false
    @State private var deleting: GymProfile?

    var body: some View {
        List {
            ThemedSection(gyms.count == 1 ? "1 Gym" : "\(gyms.count) Gyms") {
                ForEach(gyms) { gym in
                    let isDefault = gym.id == defaultGym?.id
                    Button { editing = gym.id } label: { GymRow(gym: gym, isDefault: isDefault) }
                        .buttonStyle(.plain)
                        .accessibilityHint("Opens the gym profile")
                        .listRowBackground(Theme.background)
                        .swipeActions(edge: .leading) {
                            if !isDefault {
                                Button("Set as Default", systemImage: "star") { store.setDefaultGym(gym.id) }
                                    .tint(Theme.accent)
                            }
                        }
                        .swipeActions(edge: .trailing) {
                            if !isDefault {
                                Button("Delete", systemImage: "trash") { deleting = gym }
                                    .tint(.red)
                            }
                            Button("Edit", systemImage: "pencil") { editing = gym.id }
                                .tint(Theme.surfaceRaised)
                        }
                        .contextMenu {
                            Button("Set as Default", systemImage: "star") { store.setDefaultGym(gym.id) }
                                .disabled(isDefault)
                            Button("Edit", systemImage: "pencil") { editing = gym.id }
                            Button("Delete", systemImage: "trash", role: .destructive) { deleting = gym }
                                .disabled(isDefault)
                        }
                }
            }
        }
        .listStyle(.plain)
        .themedList()
        .detailTitle("Gym Profiles")
        .pinnedActions {
            Button("Add New Gym Profile") { adding = true }
                .secondaryPill()
        }
        .alert("Delete \(deleting?.name ?? "gym")?", isPresented: Binding { deleting != nil } set: { if !$0 { deleting = nil } }) {
            Button("Delete", role: .destructive) {
                if let deleting { store.delete(GymProfile.self, id: deleting.id) }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Its equipment and weights are removed.")
        }
        .sheet(isPresented: $adding) {
            NewGymSheet(makesDefault: gyms.isEmpty) { editing = $0 }
        }
        .navigationDestination(item: $editing) { GymProfileEditor(gymID: $0) }
        .feedback(self)
    }
}

private struct GymRow: View {
    let gym: GymProfile
    let isDefault: Bool

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: gym.icon)
                .font(.system(size: 18))
                .foregroundStyle(Theme.textPrimary)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(gym.name).font(AppFont.rowTitle).foregroundStyle(Theme.textPrimary)
                Text(gym.equipment.count == 1 ? "1 piece of equipment" : "\(gym.equipment.count) pieces of equipment")
                    .font(AppFont.caption(13))
                    .foregroundStyle(Theme.textSecondary)
                if isDefault {
                    Text("Default").font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
                }
            }
            Spacer()
        }
        .padding(.vertical, 6)
        .contentShape(.rect)
        .feedback(self)
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
                ThemedSection("Name") {
                    TextField("Gym name", text: $name)
                        .font(AppFont.medium(16))
                }
                ThemedSection("Gym Type") {
                    ForEach(GymTemplate.allCases) { option in
                        Button { template = option } label: {
                            HStack(spacing: 14) {
                                Image(systemName: option.icon).font(.system(size: 18)).frame(width: 28)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(option.title).font(AppFont.rowTitle)
                                    Text(option.summary).font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
                                }
                                Spacer()
                                SelectionMark(isOn: template == option)
                            }
                            .foregroundStyle(Theme.textPrimary)
                            .contentShape(.rect)
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(template == option ? .isSelected : [])
                    }
                }
            }
            .themedList()
            .detailTitle("New Gym Profile")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
            }
            .pinnedActions {
                Button("Create Gym Profile", action: create)
                    .primaryPill()
            }
        }
        .feedback(self)
    }

    private func create() {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        var gym = GymProfile(name: trimmed.isEmpty ? "Your Gym" : trimmed, icon: template.icon, equipment: template.equipment(from: catalog.equipment))
        gym.isDefault = makesDefault
        store.insert(gym)
        dismiss()
        onCreate(gym.id)
    }
}
