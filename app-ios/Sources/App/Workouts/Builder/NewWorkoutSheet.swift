import SwiftUI

/// The tab bar's "+" Shortcuts sheet (research spec §2, `nav-plus-01.jpg`): round shortcut buttons, the active
/// program's Up Next, and the rows, all laid out by `ShortcutsLayout`. Photos and Metrics belong to the nutrition half
/// and are cut. The sheet sizes itself to its content and grows to full height once it pushes a screen.
struct NewWorkoutSheet: View {
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(LiveWorkoutPresenter.self) private var presenter
    @Observe(AppSettings.current) private var settings
    @Observe(Program.active) private var activeProgram
    @Observe(WorkoutTemplate.all) private var templates
    @Environment(SessionHistory.self) private var history
    @State private var path = NavigationPath()
    @State private var creatingWorkout = false
    @State private var creatingProgram = false
    @State private var loggingWeight = false
    @State private var customizing = false
    @State private var startingEmpty = false
    @State private var expandsOnDismiss = false
    @State private var contentHeight: CGFloat = 320
    @State private var detent = PresentationDetent.large

    private struct UpNextKey: Hashable { let program: Program }

    private var layout: ShortcutsLayout { settings.shortcuts }
    /// The inline navigation bar and grabber above the measured content.
    private var fitted: PresentationDetent { .height(contentHeight + 76) }

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(spacing: 16) {
                    let top = layout.topRow
                    if !top.isEmpty {
                        HStack(alignment: .top) {
                            ForEach(top, id: \.self) { roundButton($0) }
                        }
                        .padding(.top, 8)
                    }
                    if layout.upNextBanner, let activeProgram,
                       let day = history.memo(UpNextKey(program: activeProgram), { activeProgram.nextDay(finished: $0) }) {
                        UpNextCard(program: activeProgram, day: day, template: day.templateID.flatMap { id in templates.first { $0.id == id } })
                    }
                    VStack(spacing: 0) {
                        ForEach(layout.rows, id: \.self) { item in
                            if item != layout.rows.first { Divider().overlay(Theme.separator).padding(.leading, 44) }
                            row(item)
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 8)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 }
            }
            .scrollBounceBehavior(.basedOnSize)
            .background(Theme.surface)
            .navigationTitle("Shortcuts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Customize Shortcuts", systemImage: "slider.horizontal.3") { customizing = true }
                }
            }
            .navigationDestination(for: ProgramRoute.self) { ProgramEditorView(programID: $0.programID, initialDayID: $0.dayID) }
            .navigationDestination(for: ShortcutsRoute.self) { _ in WorkoutHistoryView() }
        }
        .onChange(of: presenter.isExpanded) { _, expanded in
            guard expanded else { return }
            presenter.isExpanded = false
            expandsOnDismiss = true
            dismiss()
        }
        .onDisappear {
            // The root view can't present the live workout's cover while this sheet is still on screen, so a workout
            // started here (Empty Workout, or Up Next's day) shows once the sheet is gone.
            if startingEmpty { presenter.startOrResume({ .empty }, in: store) }
            if expandsOnDismiss { presenter.isExpanded = true }
        }
        .presentationDetents([fitted, .large], selection: $detent)
        .onChange(of: path.isEmpty, initial: true) { detent = path.isEmpty ? fitted : .large }
        .onChange(of: contentHeight) { if path.isEmpty { detent = fitted } }
        .sheet(isPresented: $loggingWeight) { BodyWeightLogSheet() }
        .sheet(isPresented: $customizing) { CustomizeShortcutsSheet() }
        .fullScreenCover(isPresented: $creatingWorkout) {
            CreateWorkoutView { _ in dismiss() }
        }
        .fullScreenCover(isPresented: $creatingProgram) {
            NewProgramWizard { dismiss() }
        }
    }

    private func perform(_ shortcut: Shortcut) {
        switch shortcut {
        case .weight: loggingWeight = true
        case .history: path.append(ShortcutsRoute.history)
        case .emptyWorkout:
            startingEmpty = true
            dismiss()
        case .newProgram: creatingProgram = true
        case .newWorkout: creatingWorkout = true
        }
    }

    private func roundButton(_ shortcut: Shortcut) -> some View {
        Button { perform(shortcut) } label: {
            VStack(spacing: 8) {
                Image(systemName: shortcut.icon)
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 44, height: 44)
                    .background(Theme.surfaceRaised, in: .circle)
                Text(shortcut.title).font(AppFont.medium(13))
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func row(_ shortcut: Shortcut) -> some View {
        Button { perform(shortcut) } label: {
            HStack(spacing: 18) {
                Image(systemName: shortcut.icon).frame(width: 26)
                Text(shortcut.title).font(AppFont.headline())
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary)
            }
            .padding(.vertical, 16)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

private enum ShortcutsRoute: Hashable {
    case history
}

/// "Up Next • <day>": the active program's first day not yet done. A workout day opens in the editor; a rest day is a
/// plain row ticked in place.
private struct UpNextCard: View {
    let program: Program
    let day: ProgramDay
    let template: WorkoutTemplate?
    @Environment(LocalStore.self) private var store

    var body: some View {
        Group {
            if let template {
                NavigationLink(value: ProgramRoute(programID: program.id, dayID: day.id)) {
                    HStack(spacing: 12) {
                        TemplateSummary(template: template, title: "Up Next • \(template.name)")
                        Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            } else {
                HStack {
                    Text("Up Next • Rest Day").font(AppFont.headline())
                    Spacer()
                    Button("Tick rest day", systemImage: "square") { store.tickRestDay(day.id, in: program.id, done: true) }
                        .labelStyle(.iconOnly)
                        .font(.system(size: 20))
                        .foregroundStyle(Theme.textSecondary)
                        .buttonStyle(.plain)
                }
            }
        }
        .padding(14)
        .overlay { RoundedRectangle(cornerRadius: Theme.smallCornerRadius).strokeBorder(Theme.textTertiary) }
    }
}

/// The sliders button's customization: the Up Next banner, the shortcut pinned to the top row, and the order and
/// visibility of the rest.
private struct CustomizeShortcutsSheet: View {
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Observe(AppSettings.current) private var settings

    var body: some View {
        let layout = settings.shortcuts
        NavigationStack {
            List {
                Section {
                    Toggle("Up Next", isOn: Binding(get: { layout.upNextBanner }, set: { on in store.updateSettings { $0.shortcuts.upNextBanner = on } }))
                        .tint(Theme.accent)
                } footer: {
                    Text("Shows the active program's next day.")
                }
                Section("Top Row") {
                    Picker("Pinned shortcut", selection: Binding(get: { layout.top }, set: { top in store.updateSettings { $0.shortcuts.top = top } })) {
                        ForEach(Shortcut.allCases, id: \.self) { Label($0.title, systemImage: $0.icon).tag($0) }
                    }
                }
                Section("Shortcuts") {
                    ForEach(layout.items.filter { $0 != layout.top }, id: \.self) { item in
                        visibility(item, visible: true)
                    }
                    .onMove { from, to in
                        store.updateSettings { settings in
                            var shown = settings.shortcuts.items.filter { $0 != settings.shortcuts.top }
                            shown.move(fromOffsets: from, toOffset: to)
                            settings.shortcuts.items = shown + settings.shortcuts.items.filter { $0 == settings.shortcuts.top }
                        }
                    }
                    ForEach(layout.hidden, id: \.self) { item in
                        visibility(item, visible: false).moveDisabled(true)
                    }
                }
            }
            .environment(\.editMode, .constant(.active))
            .themedList()
            .navigationTitle("Customize Shortcuts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", systemImage: "checkmark") { dismiss() }
                }
            }
        }
    }

    private func visibility(_ item: Shortcut, visible: Bool) -> some View {
        Toggle(isOn: Binding(get: { visible }, set: { show in store.updateSettings { $0.shortcuts.setVisible(item, show) } })) {
            Label { Text(item.title) } icon: { Image(systemName: item.icon).foregroundStyle(Theme.textPrimary) }
        }
        .tint(Theme.accent)
    }
}

extension Shortcut: CaseIterable {
    static let allCases: [Shortcut] = [.weight, .history, .emptyWorkout, .newProgram, .newWorkout]

    var title: String {
        switch self {
        case .weight: "Weight"
        case .history: "History"
        case .emptyWorkout: "Empty Workout"
        case .newWorkout: "New Workout"
        case .newProgram: "New Program"
        }
    }

    var icon: String {
        switch self {
        case .weight: "scalemass.fill"
        case .history: "clock.arrow.circlepath"
        case .emptyWorkout: "arrow.right.to.line"
        case .newWorkout: "dumbbell.fill"
        case .newProgram: "point.topleft.down.to.point.bottomright.curvepath"
        }
    }

    /// Weight and History are round buttons by nature; the rest are rows unless pinned to the top row.
    var isRound: Bool { self == .weight || self == .history }
}

extension ShortcutsLayout {
    /// The round buttons: every visible round shortcut in `items` order, then `top` when `items` does not hold it.
    var topRow: [Shortcut] {
        items.filter { $0.isRound || $0 == top } + (items.contains(top) ? [] : [top])
    }

    /// The rows under Up Next: every visible shortcut that is not a round button, in `items` order.
    var rows: [Shortcut] {
        items.filter { !$0.isRound && $0 != top }
    }

    var hidden: [Shortcut] {
        Shortcut.allCases.filter { !items.contains($0) && $0 != top }
    }

    mutating func setVisible(_ shortcut: Shortcut, _ visible: Bool) {
        items.removeAll { $0 == shortcut }
        if visible { items.append(shortcut) }
    }
}

extension WorkoutSession {
    /// "Empty" is the reference's name for a workout started without a template.
    static var empty: WorkoutSession { WorkoutSession(name: "Empty") }
}
