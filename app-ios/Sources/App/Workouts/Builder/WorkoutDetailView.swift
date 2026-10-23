import SwiftData
import SwiftUI

/// A library workout: the editor with Workout Options and a pinned Start Workout. Edits save as they happen.
struct WorkoutDetailView: View {
    @Bindable var template: WorkoutTemplate

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Environment(LiveWorkoutPresenter.self) private var presenter
    @State private var renaming = false
    @State private var newName = ""
    @State private var confirmingDelete = false

    var body: some View {
        if template.isDeleted {
            Color.clear
        } else {
            editor
        }
    }

    private var editor: some View {
        WorkoutEditor(blocks: $template.blocks)
            .navigationTitle(template.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .tabBar)
            .toolbar {
                Menu("Workout Options", systemImage: "ellipsis") {
                    Button { newName = template.name; renaming = true } label: {
                        Label("Name", systemImage: "textformat")
                        Text(template.name)
                    }
                    Button("Duplicate Workout", systemImage: "plus.square.on.square") {
                        context.insert(WorkoutTemplate(name: "\(template.name) Copy", notes: template.notes, blocks: template.blocks.copy()))
                    }
                    Button("Delete Workout", systemImage: "trash", role: .destructive) { confirmingDelete = true }
                }
            }
            .safeAreaInset(edge: .bottom) {
                PinnedActionButton("Start Workout") {
                    presenter.startOrResume({ WorkoutSession(startingFrom: template) }, in: context)
                }
            }
            .alert("Name", isPresented: $renaming) {
                TextField("Name", text: $newName)
                Button("Save") {
                    let trimmed = newName.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !trimmed.isEmpty { template.name = trimmed }
                }
                Button("Cancel", role: .cancel) {}
            }
            .confirmationDialog("Delete \(template.name)?", isPresented: $confirmingDelete, titleVisibility: .visible) {
                Button("Delete Workout", role: .destructive) {
                    dismiss()
                    context.delete(template)
                }
            } message: {
                Text("Past sessions of this workout stay in your history.")
            }
    }
}
