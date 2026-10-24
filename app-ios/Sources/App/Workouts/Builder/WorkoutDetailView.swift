import SwiftUI

/// A library workout: the editor with Workout Options and a pinned Start Workout. Edits save as they happen. The editor
/// works on its own copy of the blocks and writes each change through; a change from another device replaces the copy
/// only while no write of ours is still on its way.
struct WorkoutDetailView: View {
    let templateID: WorkoutTemplate.ID

    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(LiveWorkoutPresenter.self) private var presenter
    @Environment(ExerciseCatalog.self) private var catalog
    @Observe(GymProfile.all) private var gyms
    @Observe private var template: WorkoutTemplate?
    @State private var blocks: [WorkoutBlock]?
    @State private var renaming = false
    @State private var newName = ""
    @State private var confirmingDelete = false

    init(templateID: WorkoutTemplate.ID) {
        self.templateID = templateID
        _template = Observe(WorkoutTemplate.one(templateID))
    }

    var body: some View {
        // After a delete the pop is still animating, so the screen stays blank instead of showing a missing row.
        if let template {
            editor(template)
        } else {
            Color.clear
        }
    }

    private func exportFile(_ template: WorkoutTemplate) -> TransferFile {
        let (exercises, gyms) = (catalog.all, gyms)
        return TransferFile { try MFTransfer.export(template, exercises: exercises, gyms: gyms, at: $0) }
    }

    private func editor(_ template: WorkoutTemplate) -> some View {
        let shown = Binding<[WorkoutBlock]>(
            get: { blocks ?? template.blocks },
            set: { blocks = $0 }
        )
        return WorkoutEditor(blocks: shown)
            .navigationTitle(template.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .tabBar)
            .toolbar {
                Menu("Workout Options", systemImage: "ellipsis") {
                    Button { newName = template.name; renaming = true } label: {
                        Label("Name", systemImage: "textformat")
                        Text(template.name)
                    }
                    SwapGymMenu(templateID: templateID, gymID: template.gymID)
                    Button("Duplicate Workout", systemImage: "plus.square.on.square") {
                        store.insert(WorkoutTemplate(name: "\(template.name) Copy", notes: template.notes, blocks: template.blocks.copy()))
                    }
                    ShareLink(item: exportFile(template), preview: SharePreview(template.name)) {
                        Label("Export Workout", systemImage: "square.and.arrow.up")
                    }
                    Button("Delete Workout", systemImage: "trash", role: .destructive) { confirmingDelete = true }
                }
            }
            .safeAreaInset(edge: .bottom) {
                PinnedActionButton("Start Workout") {
                    presenter.startOrResume({ WorkoutSession(startingFrom: template) }, in: store)
                }
            }
            .onChange(of: blocks) { _, blocks in
                guard let blocks, blocks != template.blocks else { return }
                store.editTemplate(templateID) { $0.blocks = blocks }
            }
            .onChange(of: template.blocks) { _, remote in
                if store.pendingWrites == 0, remote != blocks { blocks = nil }
            }
            .alert("Name", isPresented: $renaming) {
                TextField("Name", text: $newName)
                Button("Save") {
                    let trimmed = newName.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !trimmed.isEmpty { store.editTemplate(templateID) { $0.name = trimmed } }
                }
                Button("Cancel", role: .cancel) {}
            }
            .confirmationDialog("Delete \(template.name)?", isPresented: $confirmingDelete, titleVisibility: .visible) {
                Button("Delete Workout", role: .destructive) {
                    dismiss()
                    store.delete(WorkoutTemplate.self, id: templateID)
                }
            } message: {
                Text("Past sessions of this workout stay in your history.")
            }
    }
}
