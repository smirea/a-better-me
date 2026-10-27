import SwiftUI

/// Actions the New Program wizard pins under a program it has just generated or started from scratch and not yet kept.
struct ProgramDraftActions {
    var save: () -> Void
    var activate: () -> Void
}

/// The program editor (research spec §3.3 and milestone-2.md §2.4): day tabs, the day's chips, its exercises with week
/// cards, Program Settings, and the pinned button. "Save & Go to Duplicate" swaps the screen to the copy in place.
struct ProgramEditorView: View {
    let programID: Program.ID
    var initialDayID: ProgramDay.ID? = nil
    var draft: ProgramDraftActions? = nil

    @State private var duplicateID: Program.ID?

    var body: some View {
        if let duplicateID {
            ProgramEditorScreen(programID: duplicateID, initialDayID: nil, draft: nil) { self.duplicateID = $0 }
                .id(duplicateID)
        } else {
            ProgramEditorScreen(programID: programID, initialDayID: initialDayID, draft: draft) { duplicateID = $0 }
        }
    }
}

private struct ProgramEditorScreen: View {
    let programID: Program.ID
    let initialDayID: ProgramDay.ID?
    let draft: ProgramDraftActions?
    let goToDuplicate: (Program.ID) -> Void

    @Environment(LocalStore.self) private var store
    @Environment(LiveWorkoutPresenter.self) private var presenter
    @Environment(\.dismiss) private var dismiss
    @Observe private var program: Program?
    @Observe(WorkoutTemplate.all) private var allTemplates
    @Observe(GymProfile.all) private var gyms
    @State private var selection: ProgramDay.ID?
    /// Add Day and Duplicate select the day they make once it lands.
    @State private var pendingIndex: Int?
    @State private var span = TargetSpan.day
    @State private var reordering = false
    @State private var settingsShown = false
    @State private var gymOptionsShown = false
    @State private var addingToRestDay = false
    @State private var renaming = false
    @State private var confirming: DayConfirmation?

    private enum DayConfirmation {
        case changeToRest, remove
    }

    init(programID: Program.ID, initialDayID: ProgramDay.ID?, draft: ProgramDraftActions?, goToDuplicate: @escaping (Program.ID) -> Void) {
        self.programID = programID
        self.initialDayID = initialDayID
        self.draft = draft
        self.goToDuplicate = goToDuplicate
        _program = Observe(Program.one(programID))
        _selection = State(initialValue: initialDayID)
    }

    var body: some View {
        // After Delete Program the pop is still animating, so the screen stays blank instead of showing a missing row.
        if let program {
            editor(program)
        } else {
            Color.clear
        }
    }

    private func editor(_ program: Program) -> some View {
        let templates = allTemplates.filter { $0.programID == program.id }
        let day = program.days.first { $0.id == selection } ?? program.days.first
        let template = day?.templateID.flatMap { id in templates.first { $0.id == id } }
        return VStack(spacing: 0) {
            ProgramEditorDayTabs(program: program, templates: templates, selected: day?.id) { selection = $0 } addDay: {
                pendingIndex = program.days.count
                store.addProgramDay(to: program.id, rest: true, name: "", gymID: nil)
            }
            if let day {
                chips(program, day: day, template: template)
                if let template {
                    ProgramDayEditor(program: program, template: template, templates: templates, span: $span, reordering: $reordering)
                        .id(template.id)
                } else {
                    restDay
                }
            } else {
                Spacer()
            }
        }
        .background(Theme.background)
        .detailTitle(draft == nil ? program.name : "Create Program")
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            Button("Program Settings", systemImage: "slider.horizontal.3") { settingsShown = true }
        }
        .safeAreaInset(edge: .bottom) { bottomButtons(program, template: template) }
        .onChange(of: program.days.map(\.id)) { _, ids in
            if let pendingIndex, ids.indices.contains(pendingIndex) {
                selection = ids[pendingIndex]
                self.pendingIndex = nil
            }
        }
        .sheet(isPresented: $settingsShown) {
            ProgramSettingsView(program: program, templates: templates, onDuplicate: goToDuplicate) { dismiss() }
        }
        .sheet(isPresented: $gymOptionsShown) {
            ProgramEditorGymOptions(gyms: gyms, selected: template?.gymID) { gymID, allDays in
                let ids = allDays ? templates.map(\.id) : template.map { [$0.id] } ?? []
                store.setDayGym(gymID, templateIDs: ids)
            }
        }
        .sheet(isPresented: $addingToRestDay) {
            ExercisePicker(mode: .add) { pick in
                guard let day else { return }
                var blocks: [WorkoutBlock] = []
                blocks.add(pick)
                let name = ProgramEditorRules.nextWorkoutName(taken: templates.map(\.name))
                store.appendBlocks(blocks, toDay: day.id, in: program.id, name: name, gymID: templates.first?.gymID)
            }
        }
        .nameAlert("Rename Day", isPresented: $renaming, initial: template?.name ?? "") { name in
            if let template { store.editTemplate(template.id) { $0.name = name } }
        }
        .alert(confirmationTitle, isPresented: .isPresent($confirming), presenting: confirming) { confirmation in
            switch confirmation {
            case .changeToRest:
                Button("Change to Rest", role: .destructive) {
                    if let day { store.toggleRestDay(day.id, in: program.id, name: "", gymID: nil) }
                }
            case .remove:
                Button("OK", role: .destructive) {
                    if let day { store.removeProgramDay(day.id, from: program.id) }
                }
            }
            Button("Go Back", role: .cancel) {}
        } message: { confirmation in
            switch confirmation {
            case .changeToRest: Text("Exercises will be cleared and the day will be turned into a Rest day.")
            case .remove: Text("This will remove the entire day from your program.")
            }
        }
    }

    private var confirmationTitle: String {
        switch confirming {
        case .changeToRest: "All exercises will be cleared for this day"
        case .remove, nil: "Remove Day?"
        }
    }

    private func chips(_ program: Program, day: ProgramDay, template: WorkoutTemplate?) -> some View {
        let isRest = template == nil
        let gymName = template?.gymID.flatMap { id in gyms.first { $0.id == id }?.name } ?? "No Gym"
        let canRemove = program.days.count > 1
        return ScrollView(.horizontal) {
            HStack(spacing: 8) {
                if isRest {
                    ProgramEditorChip("Remove", systemImage: "minus.circle.fill") { confirming = .remove }.disabled(!canRemove)
                }
                Group {
                    ProgramEditorChip(gymName, systemImage: "house.fill", trailingImage: "chevron.down") { gymOptionsShown = true }
                        .accessibilityLabel("Gym, \(gymName)")
                    ProgramEditorChip("Rename", systemImage: "square.and.pencil") { renaming = true }
                    ProgramEditorChip("Re-order", systemImage: "arrow.up.arrow.down") { reordering = true }
                    ProgramEditorChip("Duplicate", systemImage: "plus.square.on.square") {
                        pendingIndex = program.days.count
                        store.duplicateProgramDay(day.id, in: program.id)
                    }
                    ProgramEditorChip("Change to Rest", systemImage: "arrow.triangle.swap") { confirming = .changeToRest }
                }
                .disabled(isRest)
                if !isRest {
                    ProgramEditorChip("Remove", systemImage: "minus.circle.fill") { confirming = .remove }.disabled(!canRemove)
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .scrollIndicators(.hidden)
    }

    private var restDay: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Rest Day").font(AppFont.title())
                    HStack(spacing: 16) {
                        Image(systemName: "beach.umbrella")
                            .font(AppFont.title(24))
                            .foregroundStyle(Theme.textTertiary)
                        Text("You can convert the rest day into a workout day by adding exercises below")
                            .font(AppFont.caption())
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay { RoundedRectangle(cornerRadius: Theme.smallCornerRadius).strokeBorder(Theme.textTertiary) }
                }
                HStack {
                    Text("0 Exercises").font(AppFont.title())
                    Spacer()
                    Button("Add Exercises") { addingToRestDay = true }
                        .font(AppFont.headline(15))
                        .underline()
                        .buttonStyle(.plain)
                }
            }
            .padding()
        }
    }

    @ViewBuilder
    private func bottomButtons(_ program: Program, template: WorkoutTemplate?) -> some View {
        if let draft {
            VStack(spacing: 8) {
                Button { draft.save() } label: {
                    Text("Save to Library").font(AppFont.headline()).frame(maxWidth: .infinity)
                }
                .buttonStyle(.glass)
                .controlSize(.large)
                .padding(.horizontal)
                PinnedActionButton("Activate Program") { draft.activate() }
            }
        } else if !program.isActive {
            PinnedActionButton("Activate Program") {
                if program.isArchived { store.setProgramArchived(program.id, false) }
                store.activate(program.id)
            }
        } else if let template {
            PinnedActionButton("Start Workout") { store.startProgramDay(program, template: template, presenter: presenter) }
        }
    }
}

/// The scrolling day tabs: one per day, underlined when selected, then Add Day.
private struct ProgramEditorDayTabs: View {
    let program: Program
    let templates: [WorkoutTemplate]
    let selected: ProgramDay.ID?
    let select: (ProgramDay.ID) -> Void
    let addDay: () -> Void

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal) {
                HStack(spacing: 22) {
                    ForEach(program.days) { day in
                        tab(name(of: day), isSelected: day.id == selected) { select(day.id) }.id(day.id)
                    }
                    tab("Add Day", isSelected: false, action: addDay)
                }
                .padding(.horizontal)
            }
            .scrollIndicators(.hidden)
            .overlay(alignment: .bottom) { Rectangle().fill(Theme.surfaceRaised).frame(height: 2) }
            .onChange(of: selected) { _, id in
                withAnimation { proxy.scrollTo(id, anchor: .center) }
            }
            .onAppear { proxy.scrollTo(selected, anchor: .center) }
        }
    }

    private func name(of day: ProgramDay) -> String {
        day.templateID.flatMap { id in templates.first { $0.id == id }?.name } ?? "Rest"
    }

    private func tab(_ title: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(AppFont.headline(15))
                .foregroundStyle(isSelected ? Theme.textPrimary : Theme.textSecondary)
                .padding(.vertical, 12)
                .overlay(alignment: .bottom) {
                    if isSelected { Rectangle().fill(Theme.textPrimary).frame(height: 2) }
                }
        }
        .buttonStyle(.plain)
        .zIndex(1)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// A capsule action under the day tabs.
private struct ProgramEditorChip: View {
    let title: String
    let systemImage: String
    var trailingImage: String?
    let action: () -> Void

    @Environment(\.isEnabled) private var isEnabled

    init(_ title: String, systemImage: String, trailingImage: String? = nil, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.trailingImage = trailingImage
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: systemImage).font(AppFont.caption(12))
                Text(title).font(AppFont.headline(13))
                if let trailingImage { Image(systemName: trailingImage).font(AppFont.caption(11)) }
            }
            .foregroundStyle(isEnabled ? Theme.textPrimary : Theme.textTertiary)
            .padding(.horizontal, 12)
            .frame(height: 34)
            .background(Theme.surfaceRaised.opacity(isEnabled ? 1 : 0.5), in: Capsule())
        }
        .buttonStyle(.plain)
    }
}

/// "Gym Options · Impacts exercise selection": the day's gym, or every day's with Apply to All Days.
private struct ProgramEditorGymOptions: View {
    let gyms: [GymProfile]
    let selected: UUID?
    let onSelect: (UUID?, Bool) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var applyToAll = false

    var body: some View {
        NavigationStack {
            List {
                if gyms.isEmpty {
                    Text("No gym profiles yet.")
                        .font(AppFont.caption())
                        .foregroundStyle(Theme.textSecondary)
                }
                ForEach(gyms) { gym in
                    Button {
                        onSelect(gym.id, applyToAll)
                        dismiss()
                    } label: {
                        HStack(spacing: 16) {
                            Image(systemName: gym.icon).frame(width: 24)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(gym.name).font(AppFont.headline(15))
                                Text("\(gym.equipment.count) pieces of equipment")
                                    .font(AppFont.caption())
                                    .foregroundStyle(Theme.textSecondary)
                            }
                            Spacer()
                            Image(systemName: gym.id == selected ? "largecircle.fill.circle" : "circle").font(AppFont.title())
                        }
                        .foregroundStyle(Theme.textPrimary)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(gym.id == selected ? .isSelected : [])
                }
                NavigationLink {
                    GymProfilesView()
                } label: {
                    HStack(spacing: 16) {
                        Image(systemName: "house.lodge").frame(width: 24)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Manage Gym Profiles").font(AppFont.headline(15))
                            Text("Add, edit, and remove gyms")
                                .font(AppFont.caption())
                                .foregroundStyle(Theme.textSecondary)
                        }
                    }
                }
                .accessibilityLabel("Manage Gym Profiles")
                .accessibilityHint("Add, edit, and remove gyms")
                Toggle(isOn: $applyToAll) {
                    Label("Apply to All Days", systemImage: "checklist").font(AppFont.headline(15))
                }
                .tint(Theme.accent)
                .onChange(of: applyToAll) { _, on in
                    if on { onSelect(selected, true) }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Theme.surface)
            .detailTitle("Gym Options")
            .navigationSubtitle("Impacts exercise selection")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
