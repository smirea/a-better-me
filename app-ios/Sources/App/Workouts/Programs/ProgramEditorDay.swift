import Feedback
import SwiftUI

/// Target Muscles in the program editor: the selected day, or every day of the week or cycle.
enum TargetSpan: Hashable {
    case day, week
}

/// What a program day adds to `WorkoutEditor`: averaged Target Muscles with the Day / Week toggle, week cards, and the
/// program's exercise options.
struct ProgramDayContext {
    let program: Program
    let targets: @MainActor ([WorkoutBlock]) -> [MuscleTarget]
    let span: Binding<TargetSpan>
    let openCard: @MainActor (BlockExercise.ID, WeekCard) -> Void
    let move: @MainActor (BlockExercise.ID) -> Void
    let editNote: @MainActor (BlockExercise.ID) -> Void
}

/// One workout day of the program editor. Like `WorkoutDetailView`, it edits its own copy of the blocks and writes each
/// change through. A write that spans templates goes through the store, and the copy is dropped so the stored blocks
/// show.
struct ProgramDayEditor: View {
    let program: Program
    let template: WorkoutTemplate
    let templates: [WorkoutTemplate]
    @Binding var span: TargetSpan
    @Binding var reordering: Bool

    @Environment(LocalStore.self) private var store
    @Environment(ExerciseCatalog.self) private var catalog
    @State private var blocks: [WorkoutBlock]?
    @State private var sheet: DaySheet?
    @State private var noteFor: BlockExercise.ID?
    @State private var noteText = ""

    private enum DaySheet: Hashable, Identifiable {
        case targets(BlockExercise.ID, WeekCard)
        case move(BlockExercise.ID)

        var id: Self { self }
    }

    var body: some View {
        let shown = Binding<[WorkoutBlock]>(get: { blocks ?? template.blocks }, set: { blocks = $0 })
        WorkoutEditor(blocks: shown, program: context)
            .onChange(of: blocks) { _, blocks in
                guard let blocks, blocks != template.blocks else { return }
                store.edit(WorkoutTemplate.self, id: template.id) { $0.blocks = blocks }
            }
            .onChange(of: template.blocks) { _, remote in
                if store.pendingWrites == 0, remote != blocks { blocks = nil }
            }
            .sheet(item: $sheet) { sheet in
                switch sheet {
                case .targets(let id, let card):
                    if let item = shown.wrappedValue.item(id) {
                        WeekTargetsSheet(program: program, item: item, card: card, dayName: template.name) { edit, scope in
                            store.applyWeekTargets(edit, scope: scope, sourceTemplateID: template.id, in: program.id)
                            blocks = nil
                        }
                    }
                case .move(let id):
                    ProgramEditorMoveSheet(program: program, from: template.id, templates: templates) { dayID in
                        let name = ProgramEditorRules.nextWorkoutName(taken: templates.map(\.name))
                        store.moveExercise(id, from: template.id, toDay: dayID, in: program.id, name: name)
                        blocks = nil
                    }
                }
            }
            .sheet(isPresented: $reordering) { ProgramEditorReorderSheet(blocks: shown) }
            .alert("Program Note", isPresented: .isPresent($noteFor)) {
                TextField("Note", text: $noteText)
                Button("Save") {
                    guard let id = noteFor, let at = shown.wrappedValue.locate(id) else { return }
                    let trimmed = noteText.trimmingCharacters(in: .whitespacesAndNewlines)
                    shown.wrappedValue[at.block].exercises[at.item].note = trimmed.isEmpty ? nil : trimmed
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Note will display on this exercise every time you work out")
            }
    }

    private var context: ProgramDayContext {
        ProgramDayContext(
            program: program,
            targets: { current in muscleTargets(current) },
            span: $span,
            openCard: { sheet = .targets($0, $1) },
            move: { sheet = .move($0) },
            editNote: { id in
                noteText = (blocks ?? template.blocks).item(id)?.note ?? ""
                noteFor = id
            }
        )
    }

    private func muscleTargets(_ current: [WorkoutBlock]) -> [MuscleTarget] {
        var day = template
        day.blocks = current
        let counted = span == .day ? [day] : [day] + templates.filter { $0.id != template.id }
        let sets = ProgramEditorRules.averageMuscleSets(program: program, templates: counted) { catalog.exercise($0) }
        let exercises = counted.flatMap { $0.blocks.flatMap(\.exercises) }.compactMap { catalog.exercise($0.exerciseID) }
        return MuscleTarget.of(sets: sets, exercises: exercises)
    }
}

extension [WorkoutBlock] {
    func item(_ id: BlockExercise.ID) -> BlockExercise? {
        locate(id).map { self[$0.block].exercises[$0.item] }
    }
}

/// An exercise's week cards and its pinned Program Note. The note sits beside the cards when they leave it room, as the
/// single card of an unperiodized program does on a phone, and under their scrolling row otherwise.
struct WeekCardsRow: View {
    let item: BlockExercise
    let program: ProgramDayContext

    var body: some View {
        let cards = ProgramEditorRules.cards(of: program.program)
        Group {
            if let note = item.note, !note.isEmpty {
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .top, spacing: 10) {
                        cardButtons(cards)
                        PinnedNote(note: note).frame(minWidth: 160, idealWidth: 160, maxWidth: .infinity, maxHeight: .infinity)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                    VStack(alignment: .leading, spacing: 10) {
                        scrollingCards(cards)
                        PinnedNote(note: note)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                }
            } else {
                scrollingCards(cards)
            }
        }
        .feedback(self)
    }

    private func scrollingCards(_ cards: [WeekCard]) -> some View {
        ScrollView(.horizontal) {
            HStack(alignment: .top, spacing: 10) { cardButtons(cards) }
                .padding(.horizontal, 16)
        }
        .padding(.horizontal, -16)
        .scrollIndicators(.hidden)
        // A List row kept a horizontal scroll view at a stale height and cut the cards' last set off.
        .fixedSize(horizontal: false, vertical: true)
    }

    private func cardButtons(_ cards: [WeekCard]) -> some View {
        ForEach(cards) { card in
            Button { program.openCard(item.id, card) } label: {
                WeekCardView(title: card.title, sets: program.program.sets(of: item, cycle: card.cycle))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(card.title) targets")
        }
    }
}

/// The exercise's Program Note, cut to a few lines so it stays beside its card; a tap shows the rest.
private struct PinnedNote: View {
    let note: String

    @State private var expanded = false
    @State private var fullHeight: CGFloat = 0
    @State private var shownHeight: CGFloat = 0

    var body: some View {
        let cut = fullHeight > shownHeight + 1
        Button { expanded.toggle() } label: {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Image(systemName: "pin.fill").imageScale(.small).foregroundStyle(Theme.textPrimary)
                VStack(alignment: .leading, spacing: 4) {
                    if expanded {
                        Text(note).frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        // Five lines set the note's own height; beside a taller card it fills the card's height instead.
                        Text(note)
                            .lineLimit(5)
                            .hidden()
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                            .overlay(alignment: .topLeading) {
                                Text(note).onGeometryChange(for: CGFloat.self) { $0.size.height } action: { shownHeight = $0 }
                            }
                            .background(alignment: .top) {
                                Text(note)
                                    .fixedSize(horizontal: false, vertical: true)
                                    .hidden()
                                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { fullHeight = $0 }
                            }
                    }
                    if cut || expanded {
                        Text(expanded ? "Show Less" : "Show More").foregroundStyle(Theme.textPrimary)
                    }
                }
                .foregroundStyle(Theme.textSecondary)
            }
            .font(AppFont.rowDetail)
            .padding(12)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .allowsHitTesting(cut || expanded)
        .accessibilityLabel("Program Note: \(note)")
        .feedback(self)
    }
}

private struct WeekCardView: View {
    let title: String
    let sets: [WorkoutSet]?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(AppFont.rowTitle)
            if let sets {
                ForEach(Array(sets.enumerated()), id: \.element.id) { index, set in
                    TargetLine(set: set, number: sets.number(at: index))
                }
            } else {
                Text("Skipped").font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
            }
        }
        .padding(12)
        .frame(width: 150, alignment: .topLeading)
        .frame(minHeight: 96, alignment: .topLeading)
        .overlay { RoundedRectangle(cornerRadius: Theme.smallCornerRadius).strokeBorder(Theme.textTertiary) }
        .contentShape(Rectangle())
        .feedback(self)
    }
}

/// "Re-Order": the day's exercises with move handles. A superset moves whole.
struct ProgramEditorReorderSheet: View {
    @Binding var blocks: [WorkoutBlock]

    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(blocks) { block in
                    HStack(spacing: 12) {
                        ExerciseTile(exercise: block.exercises.first.flatMap { catalog.exercise($0.exerciseID) }, badge: block.isSuperset ? .superset : nil)
                        Text(block.exercises.map { catalog.name($0.exerciseID) }.joined(separator: " + "))
                            .font(AppFont.rowTitle)
                    }
                }
                .onMove { blocks.move(fromOffsets: $0, toOffset: $1) }
            }
            .listStyle(.plain)
            .environment(\.editMode, .constant(.active))
            .detailTitle("Re-Order")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", role: .confirm) { dismiss() }
                }
            }
        }
        .feedback(self)
    }
}

/// "Move": every other day as "Day 2 | Rest", "Day 3 | Workout B". Moving into a rest day makes it a workout day.
struct ProgramEditorMoveSheet: View {
    let program: Program
    let from: WorkoutTemplate.ID
    let templates: [WorkoutTemplate]
    let onMove: (ProgramDay.ID) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(Array(program.days.enumerated()), id: \.element.id) { index, day in
                    if day.templateID != from {
                        Button {
                            onMove(day.id)
                            dismiss()
                        } label: {
                            Text("Day \(index + 1) | \(name(of: day))")
                                .font(AppFont.rowTitle)
                                .foregroundStyle(Theme.textPrimary)
                        }
                    }
                }
            }
            .listStyle(.plain)
            .detailTitle("Move")
            .navigationSubtitle("Relocate the exercise in your program")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .feedback(self)
    }

    private func name(of day: ProgramDay) -> String {
        day.templateID.flatMap { id in templates.first { $0.id == id }?.name } ?? "Rest"
    }
}
