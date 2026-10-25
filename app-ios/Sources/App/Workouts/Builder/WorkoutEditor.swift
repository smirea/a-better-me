import SwiftUI

/// The workout detail body that a library workout and Create Workout share: Target Muscles, the exercise list, and every
/// edit menu. The caller adds the title, the toolbar, and the pinned button. A program day passes `program`, which
/// swaps each exercise's target lines for its week cards and adds the program's options.
struct WorkoutEditor: View {
    @Binding var blocks: [WorkoutBlock]
    var program: ProgramDayContext?

    @Environment(ExerciseCatalog.self) private var catalog
    @Observe(ExerciseSettings.all) private var settings
    @Observe(AppSettings.current) private var defaults
    @State private var sheet: EditorSheet?

    var body: some View {
        // `blocks` decodes the template's JSON on every read, so one render reads it once.
        let current = blocks
        let targets = program?.targets(current) ?? MuscleTarget.of(current, catalog: catalog)
        List {
            if !targets.isEmpty || program != nil {
                targetMuscles(targets).plainRow()
            }
            exercisesHeader(current).plainRow()
            ForEach(current) { block in
                BlockView(block: block, blocks: $blocks, sheet: $sheet, program: program).plainRow(background: block.isSuperset ? Theme.surface : .clear)
            }
            .onMove { blocks.move(fromOffsets: $0, toOffset: $1) }
            if current.isEmpty {
                ContentUnavailableView("No Exercises", systemImage: "dumbbell", description: Text("Add exercises with +"))
                    .plainRow()
            }
        }
        .listStyle(.plain)
        .themedList()
        .sheet(item: $sheet) { sheet in
            switch sheet {
            case .picker(let request):
                ExercisePicker(mode: request.mode) { apply($0, for: request) }
            case .targets(let id):
                if let binding = binding(for: id) { SetTargetsSheet(exercise: binding, allowsWarmUp: false) }
            case .info(let exerciseID):
                ExerciseDetailSheet(exerciseID: exerciseID)
            }
        }
    }

    private func targetMuscles(_ targets: [MuscleTarget]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Target Muscles").font(AppFont.title())
                Spacer()
                if let program {
                    Picker("Target Muscles span", selection: program.span) {
                        Text("Day").tag(TargetSpan.day)
                        Text(program.program.cycleNoun).tag(TargetSpan.week)
                    }
                    .pickerStyle(.segmented)
                    .fixedSize()
                }
            }
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    ForEach(targets) { MuscleTargetCard(target: $0) }
                }
                .padding(.horizontal)
            }
            .padding(.horizontal, -16)
            .scrollIndicators(.hidden)
        }
        .padding(.top, 8)
    }

    private func exercisesHeader(_ current: [WorkoutBlock]) -> some View {
        let count = current.exerciseCount
        let minutes = WorkoutEstimate.minutes(current) { item, set in
            item.restSeconds(after: set, exercise: catalog.exercise(item.exerciseID), settings: .of(item.exerciseID, in: settings), defaults: defaults)
        }
        return HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(count == 1 ? "1 Exercise" : "\(count) Exercises").font(AppFont.title())
                if program == nil {
                    Text("Estimated workout time is \(minutes) min")
                        .font(AppFont.caption())
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            Spacer()
            if program != nil {
                Button("Add Exercises") { sheet = .picker(.add) }
                    .font(AppFont.headline(15))
                    .underline()
                    .buttonStyle(.plain)
            } else {
                Button("Add Exercise", systemImage: "plus") { sheet = .picker(.add) }
                    .labelStyle(.iconOnly)
                    .buttonStyle(.glass)
                    .buttonBorderShape(.circle)
                    .controlSize(.large)
            }
        }
        .padding(.top, 12)
    }

    private func binding(for id: BlockExercise.ID) -> Binding<BlockExercise>? {
        guard let at = blocks.locate(id) else { return nil }
        let fallback = blocks[at.block].exercises[at.item]
        return Binding {
            blocks.locate(id).map { blocks[$0.block].exercises[$0.item] } ?? fallback
        } set: { newValue in
            guard let at = blocks.locate(id) else { return }
            blocks[at.block].exercises[at.item] = newValue
        }
    }

    private func apply(_ pick: ExercisePick, for request: PickerRequest) {
        switch request {
        case .add: blocks.add(pick)
        case .addToSuperset(let blockID): blocks.add(pick.exerciseIDs, toBlock: blockID)
        case .swap(let id, _):
            if let exerciseID = pick.exerciseIDs.first { blocks.swap(id, to: exerciseID) }
        }
    }
}

enum PickerRequest: Hashable {
    case add
    case addToSuperset(WorkoutBlock.ID)
    case swap(BlockExercise.ID, ExerciseID)

    var mode: ExercisePickerMode {
        if case .swap(_, let exerciseID) = self { .swap(exerciseID) } else { .add }
    }
}

enum EditorSheet: Hashable, Identifiable {
    case picker(PickerRequest)
    case targets(BlockExercise.ID)
    case info(ExerciseID)

    var id: Self { self }
}

/// One exercise, or a superset with its header and members. A block is one list row, so a reorder moves a superset whole.
private struct BlockView: View {
    let block: WorkoutBlock
    @Binding var blocks: [WorkoutBlock]
    @Binding var sheet: EditorSheet?
    let program: ProgramDayContext?

    var body: some View {
        if block.isSuperset {
            VStack(alignment: .leading, spacing: 0) {
                supersetHeader
                ForEach(block.exercises) { item in
                    if item.id != block.exercises.first?.id { Divider().padding(.leading, 62) }
                    ExerciseRow(item: item, inSuperset: true, blocks: $blocks, sheet: $sheet, program: program)
                }
            }
        } else if let item = block.exercises.first {
            ExerciseRow(item: item, inSuperset: false, blocks: $blocks, sheet: $sheet, program: program)
        }
    }

    private var supersetHeader: some View {
        let rounds = block.exercises.map(\.sets.count).max() ?? 0
        return HStack {
            VStack(alignment: .leading, spacing: 0) {
                Text(block.exercises.count > 2 ? "Circuit" : "Superset").font(AppFont.headline(15))
                Text(rounds == 1 ? "1 round" : "\(rounds) rounds")
                    .font(AppFont.caption(12))
                    .foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            Menu {
                Button("Add Exercises", systemImage: "plus") { sheet = .picker(.addToSuperset(block.id)) }
                Button("Ungroup Exercises", systemImage: "rectangle.split.1x2") { blocks.ungroup(block.id) }
                Button(role: .destructive) {
                    blocks.removeBlock(block.id)
                } label: {
                    Label("Remove Superset", systemImage: "minus.circle")
                    Text("Also removes all exercises from workout")
                }
            } label: {
                OptionsLabel(title: "Superset Options")
            }
        }
        .padding(.top, 8)
    }
}

private struct ExerciseRow: View {
    let item: BlockExercise
    let inSuperset: Bool
    @Binding var blocks: [WorkoutBlock]
    @Binding var sheet: EditorSheet?
    let program: ProgramDayContext?
    @Environment(ExerciseCatalog.self) private var catalog

    var body: some View {
        if let program {
            programRow(program)
        } else {
            workoutRow
        }
    }

    private func programRow(_ program: ProgramDayContext) -> some View {
        let exercise = catalog.exercise(item.exerciseID)
        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 16) {
                ExerciseThumbnail(exercise: exercise, inSuperset: inSuperset)
                VStack(alignment: .leading, spacing: 4) {
                    Text(catalog.name(item.exerciseID)).font(AppFont.headline(15))
                    if let exercise { MuscleTags(exercise: exercise) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                optionsMenu(hasTargets: true, program: program)
            }
            WeekCardsRow(item: item, program: program)
        }
        .padding(.vertical, 12)
    }

    private var workoutRow: some View {
        let exercise = catalog.exercise(item.exerciseID)
        let hasTargets = item.sets.contains { $0.target != nil }
        return HStack(alignment: .top, spacing: 16) {
            ExerciseThumbnail(exercise: exercise, inSuperset: inSuperset)
            VStack(alignment: .leading, spacing: 4) {
                Text(catalog.name(item.exerciseID)).font(AppFont.headline(15))
                if hasTargets {
                    ForEach(Array(item.sets.enumerated()), id: \.element.id) { index, set in
                        TargetLine(set: set, number: item.sets.number(at: index))
                    }
                } else {
                    Text("No target set").font(AppFont.caption()).foregroundStyle(Theme.textSecondary)
                }
                if let exercise { MuscleTags(exercise: exercise) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .onTapGesture { sheet = .targets(item.id) }
            optionsMenu(hasTargets: hasTargets, program: nil)
        }
        .padding(.vertical, 12)
    }

    private func optionsMenu(hasTargets: Bool, program: ProgramDayContext?) -> some View {
        Menu {
            Section(catalog.name(item.exerciseID)) {
                Button { sheet = .info(item.exerciseID) } label: {
                    Label("Info", systemImage: "chart.bar.fill")
                    Text("Learn about the exercise")
                }
                if program == nil {
                    Button { sheet = .targets(item.id) } label: {
                        Label("Targets", systemImage: "scope")
                        Text(hasTargets ? "Edit targets" : "No target set")
                    }
                }
                Menu {
                    Button("Superset with previous", systemImage: "circle.lefthalf.filled") { blocks.superset(item.id, with: .previous) }
                        .disabled(!blocks.canSuperset(item.id, with: .previous))
                    Button("Superset with next", systemImage: "circle.righthalf.filled") { blocks.superset(item.id, with: .next) }
                        .disabled(!blocks.canSuperset(item.id, with: .next))
                    if inSuperset {
                        Button("Remove from superset", systemImage: "rectangle.portrait.and.arrow.right") { blocks.detach(item.id) }
                    }
                } label: {
                    Label("Superset", systemImage: "arrow.left.arrow.right")
                    Text("Manage superset settings")
                }
                Button { sheet = .picker(.swap(item.id, item.exerciseID)) } label: {
                    Label("Swap", systemImage: "arrow.triangle.2.circlepath")
                    Text("Replace with an alternate")
                }
                if let program {
                    Button { program.move(item.id) } label: {
                        Label("Move to a different day", systemImage: "arrow.up.and.down.and.arrow.left.and.right")
                        Text("Relocate the exercise in your program")
                    }
                    Button { program.editNote(item.id) } label: {
                        Label("Program Note", systemImage: "pin")
                        Text("Note will display on this exercise every time you work out")
                    }
                }
                Button("Duplicate Exercise", systemImage: "plus.square.on.square") { blocks.duplicate(item.id) }
                Button("Remove from workout", systemImage: "minus.circle", role: .destructive) { blocks.remove(item.id) }
            }
        } label: {
            OptionsLabel(title: "Exercise Options")
        }
    }
}

/// "② 8-12 reps" with the RIR badge at the trailing edge.
struct TargetLine: View {
    let set: WorkoutSet
    let number: Int

    var body: some View {
        HStack(spacing: 6) {
            Text(set.type.badge ?? "\(number)")
                .font(AppFont.headline(11))
                .frame(width: 18, height: 18)
                .background(Theme.surfaceRaised, in: Circle())
            Text(set.targets.repsText)
                .font(AppFont.caption())
                .foregroundStyle(Theme.textSecondary)
            Spacer()
            if let rir = set.target?.rir { RIRBadge(rir: rir) }
        }
    }
}

private struct MuscleTargetCard: View {
    let target: MuscleTarget

    var body: some View {
        HStack(spacing: 10) {
            MuscleTile(muscle: target.muscle).frame(width: 72, height: 56)
            VStack(alignment: .leading, spacing: 2) {
                Text(target.muscle.displayName).font(AppFont.headline(15))
                Group {
                    Text(target.exercises == 1 ? "1 exercise" : "\(target.exercises) exercises")
                    Text("\(target.sets.formatted(.number.precision(.fractionLength(0...1)))) sets")
                }
                .font(AppFont.caption(12))
                .foregroundStyle(Theme.textSecondary)
            }
            .frame(minWidth: 70, alignment: .leading)
        }
        .padding(8)
        .padding(.trailing, 8)
        .overlay { RoundedRectangle(cornerRadius: Theme.smallCornerRadius).strokeBorder(Theme.textTertiary) }
    }
}

extension View {
    /// A full-bleed list row with no separator, for lists laid out like the reference's cards instead of table cells.
    func plainRow(background: Color = .clear) -> some View {
        listRowSeparator(.hidden)
            .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 8))
            .listRowBackground(background)
    }
}
