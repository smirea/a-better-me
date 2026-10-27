import SwiftUI

extension View {
    /// New Section's "Section Name" prompt. Add Section appends the section after the others.
    func newSectionAlert(isPresented: Binding<Bool>) -> some View {
        modifier(NewSectionAlert(isPresented: isPresented))
    }
}

private struct NewSectionAlert: ViewModifier {
    @Binding var isPresented: Bool
    @Environment(LocalStore.self) private var store
    @State private var name = ""

    func body(content: Content) -> some View {
        content
            .alert("New Section", isPresented: $isPresented) {
                TextField("Section Name", text: $name)
                Button("Add Section") {
                    let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !name.isEmpty { store.updateSettings { $0.workout.sections.addSection(named: name) } }
                }
                Button("Cancel", role: .cancel) {}
            }
            .onChange(of: isPresented) { _, shown in
                if shown { name = "" }
            }
    }
}

/// A custom section on the Workout tab: its name, Collapse, the ⋮ menu (Add Workout, Rename, Delete Section), and its
/// workouts as library cards. `library` resolves the filed ids; an id it lacks (deleted, archived, or moved into a
/// program) is skipped.
struct CustomSectionView: View {
    let section: CustomWorkoutSection
    let library: [WorkoutTemplate]
    @Environment(LocalStore.self) private var store
    @State private var addingWorkouts = false
    @State private var renaming = false
    @State private var newName = ""
    @State private var confirmingDelete = false

    var body: some View {
        let byID = Dictionary(library.map { ($0.id, $0) }) { first, _ in first }
        let templates = section.templateIDs.compactMap { byID[$0] }
        let id = section.id
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(section.name) {
                if !templates.isEmpty {
                    Button(section.collapsed ? "Expand" : "Collapse") {
                        store.updateSettings { $0.workout.sections.toggleCollapsed(id) }
                    }
                    .accessibilityLabel(section.collapsed ? "Expand \(section.name)" : "Collapse \(section.name)")
                }
                Menu("\(section.name) Options", systemImage: "ellipsis") {
                    Button("Add Workout", systemImage: "plus") { addingWorkouts = true }
                    Button("Rename", systemImage: "pencil") {
                        newName = section.name
                        renaming = true
                    }
                    Button("Delete Section", systemImage: "trash", role: .destructive) { confirmingDelete = true }
                }
                .labelStyle(.iconOnly)
                .frame(width: 32, height: 32)
            }
            if templates.isEmpty {
                Text("Workouts you add to this section appear here. Tap ⋮ to add one from your library.")
                    .font(AppFont.caption())
                    .foregroundStyle(Theme.textSecondary)
            } else if !section.collapsed {
                ForEach(templates) { template in
                    NavigationLink(value: template.id) { TemplateCard(template: template) }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button("Remove from Section", systemImage: "minus.circle") {
                                store.updateSettings { $0.workout.sections.file(template.id, in: id, false) }
                            }
                        }
                }
            }
        }
        .sheet(isPresented: $addingWorkouts) {
            SectionWorkoutsSheet(section: section, library: library)
        }
        .alert("Rename Section", isPresented: $renaming) {
            TextField("Section Name", text: $newName)
            Button("Save") {
                let name = newName.trimmingCharacters(in: .whitespacesAndNewlines)
                if !name.isEmpty { store.updateSettings { $0.workout.sections.rename(id, to: name) } }
            }
            Button("Cancel", role: .cancel) {}
        }
        .alert("Delete Section", isPresented: $confirmingDelete) {
            Button("Delete Section", role: .destructive) {
                store.updateSettings { $0.workout.sections.deleteSection(id) }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure you want to delete this section?")
        }
    }
}

/// Add Workout: every library workout with a checkmark for membership in this section. Ticking one filed in another
/// section moves it here.
private struct SectionWorkoutsSheet: View {
    let section: CustomWorkoutSection
    let library: [WorkoutTemplate]
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var filed: Set<UUID>

    init(section: CustomWorkoutSection, library: [WorkoutTemplate]) {
        self.section = section
        self.library = library
        _filed = State(initialValue: Set(section.templateIDs))
    }

    var body: some View {
        NavigationStack {
            List {
                if library.isEmpty {
                    Text("Workouts you create appear here.")
                        .font(AppFont.caption())
                        .foregroundStyle(Theme.textSecondary)
                        .listRowBackground(Theme.surface)
                }
                ForEach(library) { template in
                    let isFiled = filed.contains(template.id)
                    Button {
                        let id = section.id
                        let templateID = template.id
                        if isFiled { filed.remove(templateID) } else { filed.insert(templateID) }
                        store.updateSettings { $0.workout.sections.file(templateID, in: id, !isFiled) }
                    } label: {
                        HStack(spacing: 12) {
                            Text(template.name).font(AppFont.headline(15))
                            Spacer()
                            Image(systemName: isFiled ? "checkmark.square.fill" : "square").font(.system(size: 20))
                        }
                        .foregroundStyle(Theme.textPrimary)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .listRowBackground(Theme.surface)
                    .accessibilityAddTraits(isFiled ? .isSelected : [])
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.surface)
            .navigationTitle("Add Workout")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
