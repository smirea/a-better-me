import SwiftData
import SwiftUI

/// Create Workout, cut to the reference's name step and editor. The method step (build or import .xlsx) and the gym step
/// are out of milestone 1.
struct CreateWorkoutView: View {
    var onSave: (WorkoutTemplate) -> Void = { _ in }

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var name = Date.now.formatted(.dateTime.month(.abbreviated).day().year())
    @State private var blocks: [WorkoutBlock] = []
    @State private var editing = false
    @State private var confirmingExit = false

    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 24) {
                ProgressView(value: 0.5).tint(Theme.textPrimary)
                Text("What would you like to name this workout?").font(AppFont.title())
                VStack(alignment: .leading, spacing: 8) {
                    Text("Name").font(AppFont.headline(14))
                    TextField("Name", text: $name)
                        .padding(12)
                        .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
                        .submitLabel(.next)
                        .onSubmit { if !trimmedName.isEmpty { editing = true } }
                }
                Spacer()
            }
            .padding(.horizontal)
            .background(Theme.background)
            .safeAreaInset(edge: .bottom) {
                PinnedActionButton("Next") { editing = true }.disabled(trimmedName.isEmpty)
            }
            .navigationTitle("Create Workout")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") {
                        if blocks.isEmpty { dismiss() } else { confirmingExit = true }
                    }
                }
            }
            .navigationDestination(isPresented: $editing) { editor }
            .confirmationDialog("Exit the editor?", isPresented: $confirmingExit, titleVisibility: .visible) {
                Button("Exit", role: .destructive) { dismiss() }
                Button("Stay", role: .cancel) {}
            } message: {
                Text("Changes you made to your workout will be discarded.")
            }
        }
        .tint(Theme.textPrimary)
    }

    private var editor: some View {
        WorkoutEditor(blocks: $blocks)
            .safeAreaInset(edge: .top, spacing: 0) {
                ProgressView(value: 1).tint(Theme.textPrimary).padding(.horizontal)
            }
            .safeAreaInset(edge: .bottom) {
                PinnedActionButton("Save to Library") {
                    let template = WorkoutTemplate(name: trimmedName, blocks: blocks)
                    context.insert(template)
                    onSave(template)
                    dismiss()
                }
                .disabled(blocks.isEmpty)
            }
            .navigationTitle("Create Workout")
            .navigationBarTitleDisplayMode(.inline)
    }
}
