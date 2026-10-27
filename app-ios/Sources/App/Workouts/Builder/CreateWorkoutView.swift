import SwiftUI

/// Create Workout: the method step (build or import .xlsx), the name step, the gym step, and the editor. An import skips
/// the name and gym steps, because the file carries both; its unmatched exercises are inserted as customs right away,
/// while the template waits for Save to Library as a built one does.
struct CreateWorkoutView: View {
    var onSave: (WorkoutTemplate) -> Void = { _ in }

    @Environment(LocalStore.self) private var store
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(\.dismiss) private var dismiss
    @Observe(GymProfile.all) private var gyms
    @Observe(GymProfile.defaultGym) private var defaultGym
    @State private var method = Method.fromScratch
    @State private var path: [Route] = []
    @State private var name = Date.now.formatted(.dateTime.month(.abbreviated).day().year())
    @State private var blocks: [WorkoutBlock] = []
    @State private var gymID: UUID?
    @State private var imported: WorkoutTemplate?
    @State private var confirmingExit = false
    @State private var importing = false
    @State private var importFailed = false
    @State private var unmatched: [String] = []

    private enum Method { case fromScratch, importFile }
    private enum Route { case name, gym, editor }

    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack(path: $path) {
            methodStep
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Close", systemImage: "xmark") {
                            if blocks.isEmpty { dismiss() } else { confirmingExit = true }
                        }
                    }
                }
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .name: nameStep
                    case .gym: gymStep
                    case .editor: editor
                    }
                }
                .confirmationDialog("Exit the editor?", isPresented: $confirmingExit, titleVisibility: .visible) {
                    Button("Exit", role: .destructive) { dismiss() }
                    Button("Stay", role: .cancel) {}
                } message: {
                    Text("Changes you made to your workout will be discarded.")
                }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.xlsx]) { importWorkout($0) }
        .alert("Import failed", isPresented: $importFailed) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("We only support select spreadsheet formats with a .xlsx extension. If the workout spreadsheet wasn't exported from MacroFactor Workouts or explicitly advertised to work with MacroFactor Workouts, it will likely fail to import. Only upload content you have permission to use. Use the program importer, not this single day workout importer, in order to import a program.")
        }
        .unmatchedExercisesAlert($unmatched)
    }

    private var methodStep: some View {
        step(progress: 1.0 / 4, title: "How would you like to create your workout?") {
            WizardOption(icon: "wrench.fill", title: "Build From Scratch", subtitle: "Start with a fully blank slate and no guidance", selected: method == .fromScratch) { method = .fromScratch }
            WizardOption(icon: "icloud.and.arrow.up.fill", title: "Import Workout From File", subtitle: "You can upload .xlsx files from previously exported workouts", selected: method == .importFile) { method = .importFile }
        } next: {
            PinnedActionButton("Next") {
                switch method {
                case .fromScratch:
                    imported = nil
                    path.append(.name)
                case .importFile: importing = true
                }
            }
        }
    }

    private var nameStep: some View {
        step(progress: 2.0 / 4, title: "What would you like to name this workout?") {
            VStack(alignment: .leading, spacing: 8) {
                Text("Name").font(AppFont.headline(14))
                TextField("Name", text: $name)
                    .padding(12)
                    .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
                    .submitLabel(.next)
                    .onSubmit { if !trimmedName.isEmpty { path.append(.gym) } }
            }
        } next: {
            PinnedActionButton("Next") { path.append(.gym) }.disabled(trimmedName.isEmpty)
        }
    }

    private var gymStep: some View {
        let chosen = gymID ?? defaultGym?.id
        return step(progress: 3.0 / 4, title: "Where will you work out?") {
            ForEach(gyms) { gym in
                WizardOption(icon: gym.icon, title: gym.name, subtitle: "\(gym.equipment.count) pieces of equipment", selected: gym.id == chosen) { gymID = gym.id }
            }
        } next: {
            PinnedActionButton("Next") { path.append(.editor) }
        }
    }

    private func step(progress: Double, title: String, @ViewBuilder content: () -> some View, @ViewBuilder next: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 24) {
            ProgressView(value: progress)
            Text(title).font(AppFont.sectionTitle)
            VStack(alignment: .leading, spacing: 12) { content() }
            Spacer()
        }
        .padding(.horizontal, Theme.margin)
        .background(Theme.background)
        .safeAreaInset(edge: .bottom) { next() }
        .detailTitle("Create Workout")
    }

    private func importWorkout(_ result: Result<URL, Error>) {
        do {
            let file = try MFTransfer.importWorkout(TransferFile.read(result.get()), exercises: catalog.all, gyms: gyms)
            file.insertNewExercises(into: store)
            imported = file.value
            name = file.value.name
            blocks = file.value.blocks
            path = [.editor]
            unmatched = file.newExercises.map(\.name)
        } catch {
            importFailed = true
        }
    }

    private var editor: some View {
        WorkoutEditor(blocks: $blocks)
            .safeAreaInset(edge: .top, spacing: 0) {
                ProgressView(value: 1).padding(.horizontal, Theme.margin)
            }
            .safeAreaInset(edge: .bottom) {
                PinnedActionButton("Save to Library") {
                    var template = imported ?? WorkoutTemplate(name: trimmedName)
                    template.name = trimmedName
                    template.blocks = blocks
                    if imported == nil { template.gymID = gymID ?? defaultGym?.id }
                    store.insert(template)
                    onSave(template)
                    dismiss()
                }
                .disabled(blocks.isEmpty)
            }
            .detailTitle("Create Workout")
    }
}
