import Feedback
import SwiftUI

/// The Workout tab's Active Program (research spec milestone-2.md §2.2): the position link and the program card with
/// its day checkboxes. Nothing when no program is active.
struct ActiveProgramSection: View {
    let program: Program?
    let templates: [UUID: WorkoutTemplate]
    let finishedDays: Set<ProgramDay.ID>
    @Environment(LocalStore.self) private var store
    @State private var choosingCycle = false

    var body: some View {
        if let program {
            FlatSection("Active Program", spacing: 4) {
                Button(program.cycleLabel(program.currentCycle)) { choosingCycle = true }
                    .accessibilityHint("Go to another \(program.cycleNoun.lowercased())")
            } content: {
                ProgramCard(program: program, templates: templates, accessory: .checkbox(finishedDays: finishedDays) { day, done in
                    store.tickRestDay(day.id, in: program.id, done: done)
                })
            }
            .sheet(isPresented: $choosingCycle) { GoToCycleSheet(program: program) }
            .feedback(self)
        }
    }
}

/// "Go to...": every cycle of the program, the deload included. Picking one moves the program there.
private struct GoToCycleSheet: View {
    let program: Program
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    /// The rows' height, which the sheet fits instead of a fixed half screen.
    @State private var contentHeight: CGFloat = 300

    var body: some View {
        NavigationStack {
            List {
                ThemedSection {
                    ForEach(1...program.totalCycles, id: \.self) { cycle in
                        Button {
                            store.goToCycle(cycle, in: program.id)
                            dismiss()
                        } label: {
                            HStack(spacing: 16) {
                                Text(program.cycleLabel(cycle)).font(AppFont.rowTitle)
                                Spacer()
                                SelectionMark(isOn: cycle == program.currentCycle)
                            }
                            .contentShape(Rectangle())
                        }
                        .foregroundStyle(Theme.textPrimary)
                        .accessibilityAddTraits(cycle == program.currentCycle ? .isSelected : [])
                    }
                }
            }
            .flatList()
            .onScrollGeometryChange(for: CGFloat.self) { $0.contentSize.height } action: { _, height in contentHeight = height }
            .detailTitle("Go To")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
            }
        }
        // The inline navigation bar and grabber sit above the measured rows.
        .presentationDetents([.height(contentHeight + 76), .large])
        .feedback(self)
    }
}
