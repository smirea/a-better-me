import SwiftUI

/// Program Settings (milestone-2.md §2.5). Every row writes as it changes; the editor behind it follows the store.
struct ProgramSettingsView: View {
    let program: Program
    let templates: [WorkoutTemplate]
    let onDuplicate: (Program.ID) -> Void
    let onDelete: () -> Void

    @Environment(LocalStore.self) private var store
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(\.dismiss) private var dismiss
    @Observe(GymProfile.all) private var gyms
    @State private var page: Page?
    @State private var confirming: Confirmation?
    @State private var renaming = false
    @State private var newName = ""

    private enum Page: Identifiable {
        case colorIcon, dayOrder, deload, duplicate
        var id: Self { self }
    }

    private enum Confirmation {
        case periodizationOff, deactivate, delete
    }

    var body: some View {
        NavigationStack {
            List {
                row("Number of \(program.cycleNoun)s", program.weeksText, systemImage: "heart.fill") { weeksStepper }
                row("Name", program.name, systemImage: "textformat.size") {
                    editButton("Name") {
                        newName = program.name
                        renaming = true
                    }
                }
                row("Color & Icon", "\(program.color.title), \(ProgramIcon.title(of: program.icon))", icon: colorIconTile) {
                    editButton("Color & Icon") { page = .colorIcon }
                }
                row("Day Order", program.days.map { $0.templateID == nil ? "R" : "W" }.joined(separator: ", "), systemImage: "calendar") {
                    editButton("Day Order") { page = .dayOrder }
                }
                row("Deload", program.config.deload.title(noun: program.cycleNoun), systemImage: "cloud.fill") {
                    editButton("Deload") { page = .deload }
                }
                periodizationRow
                actionRow("Duplicate Program", systemImage: "rectangle.on.rectangle", chevron: true) { page = .duplicate }
                ShareLink(item: exportFile, preview: SharePreview(program.name)) {
                    actionLabel("Export Program", systemImage: "square.and.arrow.down")
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Export Program")
                if program.isActive {
                    actionRow("Deactivate Program", systemImage: "flag.fill") { confirming = .deactivate }
                } else {
                    actionRow("Activate Program", systemImage: "flag.fill") {
                        if program.isArchived { store.setProgramArchived(program.id, false) }
                        store.activate(program.id)
                    }
                }
                actionRow(program.isArchived ? "Unarchive Program" : "Archive Program", systemImage: "archivebox.fill") {
                    store.setProgramArchived(program.id, !program.isArchived)
                }
                actionRow("Delete Program", systemImage: "trash.fill", tint: Theme.destructive) { confirming = .delete }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Theme.surface)
            .programSheetTitle("Program Settings", subtitle: program.name)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
            .sheet(item: $page) { page in
                switch page {
                case .colorIcon: ProgramSettingsColorIcon(program: program)
                case .dayOrder:
                    ProgramSettingsDayOrder(program: program, templates: templates) { store.reorderProgramDays($0, in: program.id) }
                case .deload: ProgramSettingsDeload(program: program)
                case .duplicate:
                    ProgramSettingsDuplicate { name in
                        Task {
                            guard let id = try? await store.duplicateProgram(program, templates: templates, named: name).value else { return }
                            dismiss()
                            onDuplicate(id)
                        }
                    }
                }
            }
            .alert("Name", isPresented: $renaming) {
                TextField("Name", text: $newName)
                Button("Save") {
                    let trimmed = newName.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !trimmed.isEmpty { store.editProgram(program.id) { $0.name = trimmed } }
                }
                Button("Cancel", role: .cancel) {}
            }
            .alert(confirmationTitle, isPresented: Binding { confirming != nil } set: { if !$0 { confirming = nil } }, presenting: confirming) { confirmation in
                switch confirmation {
                case .periodizationOff:
                    Button("Turn Off", role: .destructive) { store.setPeriodization(false, in: program.id) }
                case .deactivate:
                    Button("OK", role: .destructive) { store.deactivateProgram(program.id) }
                case .delete:
                    Button("Delete Program", role: .destructive) {
                        store.deleteProgram(program.id)
                        dismiss()
                        onDelete()
                    }
                }
                Button("Go Back", role: .cancel) {}
            } message: { confirmation in
                switch confirmation {
                case .periodizationOff:
                    Text("Periodization is what allows cycle-to-cycle variation. When disabled, all weeks for an exercise will use identical sets and targets. The impact of turning this off is not reversible.")
                case .deactivate:
                    Text("Your active program will be moved to your Workout Library and its progress will be reset.")
                case .delete:
                    Text("The program and workouts within the program will be deleted.")
                }
            }
        }
    }

    private var confirmationTitle: String {
        switch confirming {
        case .periodizationOff: "Turn off periodization?"
        case .deactivate: "Are you sure you want to deactivate this program?"
        case .delete, nil: "Are you sure you want to delete this program?"
        }
    }

    private var weeksStepper: some View {
        HStack(spacing: 10) {
            stepButton("Remove a \(program.cycleNoun.lowercased())", systemImage: "minus") { store.setProgramWeeks(program.cycles - 1, in: program.id) }
                .disabled(program.cycles <= 1)
            Text("\(program.cycles)").font(AppFont.headline()).monospacedDigit().frame(minWidth: 22)
            stepButton("Add a \(program.cycleNoun.lowercased())", systemImage: "plus") { store.setProgramWeeks(program.cycles + 1, in: program.id) }
                .disabled(program.cycles >= ProgramSettingsView.maxWeeks)
        }
    }

    static let maxWeeks = 52

    private var periodizationRow: some View {
        let isOn = Binding {
            program.config.periodization
        } set: { on in
            if on { store.setPeriodization(true, in: program.id) } else { confirming = .periodizationOff }
        }
        return Toggle(isOn: isOn) {
            settingLabel("Periodization", "Organize your training into phases that vary intensity and volume to support continuous progress and effective recovery", icon: Image(systemName: "chart.bar.xaxis").settingIcon())
        }
        .tint(Theme.accent)
        .padding(.vertical, 6)
    }

    private var colorIconTile: some View {
        Image(systemName: program.icon)
            .font(AppFont.caption(12))
            .foregroundStyle(.white)
            .frame(width: 24, height: 24)
            .background(program.color.swatch, in: RoundedRectangle(cornerRadius: 6))
    }

    private func row(_ title: String, _ value: String, systemImage: String, @ViewBuilder trailing: () -> some View) -> some View {
        row(title, value, icon: Image(systemName: systemImage).settingIcon(), trailing: trailing)
    }

    private func row(_ title: String, _ value: String, icon: some View, @ViewBuilder trailing: () -> some View) -> some View {
        HStack {
            settingLabel(title, value, icon: icon)
            Spacer()
            trailing()
        }
        .padding(.vertical, 6)
    }

    private func settingLabel(_ title: String, _ value: String, icon: some View) -> some View {
        HStack(spacing: 16) {
            icon.frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(AppFont.headline(15))
                Text(value).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
            }
        }
    }

    private func editButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button("Edit", action: action)
            .font(AppFont.headline(14))
            .buttonStyle(.glass)
            .accessibilityLabel("Edit \(title)")
    }

    private func stepButton(_ label: String, systemImage: String, action: @escaping () -> Void) -> some View {
        Button(label, systemImage: systemImage, action: action)
            .labelStyle(.iconOnly)
            .buttonStyle(.glass)
            .buttonBorderShape(.circle)
    }

    private var exportFile: TransferFile {
        let (program, templates, exercises, gyms) = (program, templates, catalog.all, gyms)
        return TransferFile { try MFTransfer.export(program, templates: templates, exercises: exercises, gyms: gyms, at: $0) }
    }

    private func actionRow(_ title: String, systemImage: String, tint: Color = Theme.textPrimary, chevron: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            actionLabel(title, systemImage: systemImage, tint: tint, chevron: chevron)
        }
        .buttonStyle(.plain)
    }

    private func actionLabel(_ title: String, systemImage: String, tint: Color = Theme.textPrimary, chevron: Bool = false) -> some View {
        HStack(spacing: 16) {
            Image(systemName: systemImage).settingIcon().frame(width: 24)
            Text(title).font(AppFont.headline(15))
            Spacer()
            if chevron { Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary) }
        }
        .foregroundStyle(tint)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }
}

private extension Image {
    func settingIcon() -> some View {
        font(AppFont.headline(17)).foregroundStyle(Theme.textPrimary)
    }
}

private extension Program {
    /// "7 Weeks", "1 Cycle".
    var weeksText: String { cycles == 1 ? "1 \(cycleNoun)" : "\(cycles) \(cycleNoun)s" }
}

private extension Deload {
    static let choices: [Deload] = [.none, .firstCycle, .lastCycle]

    func title(noun: String) -> String {
        switch self {
        case .none: "None"
        case .firstCycle: "First \(noun)"
        case .lastCycle: "Last \(noun)"
        }
    }

    var summary: String {
        switch self {
        case .none: "Train continuously without scheduled reductions in intensity or volume."
        case .firstCycle: "Start each training block with a lower-intensity week to ease into new workloads and reduce soreness."
        case .lastCycle: "Finish each training block with a lighter week to promote recovery and readiness for the next phase."
        }
    }
}

/// The Color & Icon picker's glyphs. MF offers about fifty; these are SF Symbols close to its set.
enum ProgramIcon {
    static let all: [(symbol: String, title: String)] = [
        ("dumbbell.fill", "Dumbbell"), ("figure.strengthtraining.traditional", "Lifter"), ("figure.strengthtraining.functional", "Functional"),
        ("figure.run", "Runner"), ("figure.walk", "Walker"), ("figure.hiking", "Hiker"), ("figure.outdoor.cycle", "Cyclist"),
        ("figure.pool.swim", "Swimmer"), ("figure.rower", "Rower"), ("figure.yoga", "Yoga"), ("figure.pilates", "Pilates"),
        ("figure.boxing", "Boxing"), ("figure.martial.arts", "Martial Arts"), ("figure.climbing", "Climbing"), ("figure.core.training", "Core"),
        ("figure.cross.training", "Cross Training"), ("figure.flexibility", "Flexibility"), ("figure.jumprope", "Jump Rope"),
        ("figure.step.training", "Step"), ("figure.highintensity.intervaltraining", "Intervals"), ("figure.cooldown", "Cooldown"),
        ("figure.mixed.cardio", "Cardio"), ("figure.stairs", "Stairs"), ("figure.skiing.downhill", "Skiing"), ("figure.surfing", "Surfing"),
        ("figure.basketball", "Basketball"), ("figure.soccer", "Soccer"), ("figure.tennis", "Tennis"), ("figure.golf", "Golf"),
        ("paperplane.fill", "Paper Plane"), ("flame.fill", "Flame"), ("bolt.fill", "Bolt"), ("star.fill", "Star"), ("heart.fill", "Heart"),
        ("trophy.fill", "Trophy"), ("medal.fill", "Medal"), ("crown.fill", "Crown"), ("target", "Target"), ("mountain.2.fill", "Mountain"),
        ("sun.max.fill", "Sun"), ("moon.fill", "Moon"), ("leaf.fill", "Leaf"), ("drop.fill", "Drop"), ("snowflake", "Snowflake"),
        ("timer", "Timer"), ("stopwatch.fill", "Stopwatch"), ("calendar", "Calendar"), ("chart.line.uptrend.xyaxis", "Progress"),
        ("scalemass.fill", "Scale"), ("shield.fill", "Shield"), ("hare.fill", "Hare"), ("tortoise.fill", "Tortoise"), ("pawprint.fill", "Paw"),
    ]

    static func title(of symbol: String) -> String {
        all.first { $0.symbol == symbol }?.title ?? symbol
    }
}

/// The icon glyphs as a six-column grid, the selected one on the program color. Program Settings' Color & Icon and the
/// New Program wizard's color step share it.
struct ProgramIconGrid: View {
    let selection: String
    let color: ProgramColor
    let onPick: (String) -> Void

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 6), spacing: 12) {
            ForEach(ProgramIcon.all, id: \.symbol) { icon in
                Button { onPick(icon.symbol) } label: {
                    Image(systemName: icon.symbol)
                        .font(AppFont.title(18))
                        .foregroundStyle(icon.symbol == selection ? .white : Theme.textSecondary)
                        .frame(width: 48, height: 48)
                        .background(icon.symbol == selection ? color.swatch : Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(icon.title)
                .accessibilityAddTraits(icon.symbol == selection ? .isSelected : [])
            }
        }
    }
}

private struct ProgramSettingsColorIcon: View {
    let program: Program

    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Color").font(AppFont.title(18))
                    HStack {
                        ForEach(ProgramColor.allCases, id: \.self) { color in
                            Button { store.editProgram(program.id) { $0.color = color } } label: {
                                Circle()
                                    .fill(color.swatch)
                                    .frame(width: 36, height: 36)
                                    .overlay { if color == program.color { Circle().strokeBorder(Theme.textPrimary, lineWidth: 3).padding(-5) } }
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(color.title)
                            .accessibilityAddTraits(color == program.color ? .isSelected : [])
                        }
                    }
                    Text("Icon").font(AppFont.title(18))
                    ProgramIconGrid(selection: program.icon, color: program.color) { symbol in
                        store.editProgram(program.id) { $0.icon = symbol }
                    }
                }
                .padding()
            }
            .background(Theme.surface)
            .programSheetTitle("Color & Icon", subtitle: "\(program.color.title), \(ProgramIcon.title(of: program.icon))")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

/// "Day Order · N-Day Cycle": the days as a reorderable list, saved together.
private struct ProgramSettingsDayOrder: View {
    let program: Program
    let templates: [WorkoutTemplate]
    let onSave: ([ProgramDay.ID]) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var order: [ProgramDay]

    init(program: Program, templates: [WorkoutTemplate], onSave: @escaping ([ProgramDay.ID]) -> Void) {
        self.program = program
        self.templates = templates
        self.onSave = onSave
        _order = State(initialValue: program.days)
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(Array(order.enumerated()), id: \.element.id) { index, day in
                    HStack {
                        Text("Day \(index + 1)").font(AppFont.body(15))
                        Spacer()
                        pill(day)
                    }
                }
                .onMove { order.move(fromOffsets: $0, toOffset: $1) }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Theme.surface)
            .environment(\.editMode, .constant(.active))
            .programSheetTitle("Day Order", subtitle: "\(order.count)-Day Cycle")
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 4) {
                    PinnedActionButton("Save") {
                        onSave(order.map(\.id))
                        dismiss()
                    }
                    Button("Cancel") { dismiss() }
                        .font(AppFont.headline())
                        .buttonStyle(.plain)
                        .frame(minHeight: 44)
                }
            }
        }
    }

    private func pill(_ day: ProgramDay) -> some View {
        let name = day.templateID.flatMap { id in templates.first { $0.id == id }?.name }
        return Text(name ?? "Rest Day")
            .font(AppFont.headline(14))
            .foregroundStyle(name == nil ? Theme.textTertiary : Theme.textPrimary)
            .padding(.horizontal, 12)
            .frame(height: 34)
            .overlay {
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(name == nil ? Theme.textTertiary : Theme.textSecondary, style: StrokeStyle(lineWidth: 1, dash: name == nil ? [4] : []))
            }
    }
}

private struct ProgramSettingsDeload: View {
    let program: Program

    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List(Deload.choices, id: \.self) { choice in
                Button {
                    store.editProgram(program.id) { program in
                        program.config.deload = choice
                        program.currentCycle = min(program.currentCycle, program.totalCycles)
                    }
                    dismiss()
                } label: {
                    HStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(choice.title(noun: program.cycleNoun)).font(AppFont.headline(15))
                            Text(choice.summary).font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                        }
                        Spacer()
                        Image(systemName: choice == program.config.deload ? "largecircle.fill.circle" : "circle").font(AppFont.title())
                    }
                    .foregroundStyle(Theme.textPrimary)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(choice == program.config.deload ? .isSelected : [])
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Theme.surface)
            .programSheetTitle("Deload")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

/// "Program Name" for Duplicate Program, defaulting to today's date.
private struct ProgramSettingsDuplicate: View {
    let onSave: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = Date.now.formatted(date: .long, time: .omitted)
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            VStack {
                TextField("Name", text: $name)
                    .font(AppFont.body())
                    .padding()
                    .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
                    .focused($focused)
                    .padding()
                Spacer()
            }
            .background(Theme.surface)
            .programSheetTitle("Program Name")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                PinnedActionButton("Save & Go to Duplicate") {
                    let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !trimmed.isEmpty else { return }
                    dismiss()
                    onSave(trimmed)
                }
            }
            .onAppear { focused = true }
        }
        .presentationDetents([.medium])
    }
}
