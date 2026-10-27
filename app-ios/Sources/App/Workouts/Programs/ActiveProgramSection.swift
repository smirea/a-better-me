import SwiftUI

/// The Workout tab's Active Program (research spec milestone-2.md §2.2): the position link, the program card with its
/// day checkboxes, or the empty drop target when no program is active.
struct ActiveProgramSection: View {
    let program: Program?
    let templates: [UUID: WorkoutTemplate]
    let finishedDays: Set<ProgramDay.ID>
    @Environment(LocalStore.self) private var store
    @State private var choosingCycle = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader("Active Program") {
                if let program {
                    Button(program.cycleLabel(program.currentCycle)) { choosingCycle = true }
                        .accessibilityHint("Go to another \(program.cycleNoun.lowercased())")
                }
            }
            if let program {
                ProgramCard(program: program, templates: templates, accessory: .checkbox(finishedDays: finishedDays) { day, done in
                    store.tickRestDay(day.id, in: program.id, done: done)
                })
            } else {
                Text("Drag a program block here")
                    .font(AppFont.caption())
                    .foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity, minHeight: 72)
                    .overlay {
                        RoundedRectangle(cornerRadius: Theme.cornerRadius)
                            .strokeBorder(Theme.surfaceRaised, style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
                    }
            }
        }
        .sheet(isPresented: $choosingCycle) {
            if let program { GoToCycleSheet(program: program) }
        }
    }
}

/// "Go to...": every cycle of the program, the deload included. Picking one moves the program there.
private struct GoToCycleSheet: View {
    let program: Program
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List(1...program.totalCycles, id: \.self) { cycle in
                Button {
                    store.goToCycle(cycle, in: program.id)
                    dismiss()
                } label: {
                    HStack(spacing: 16) {
                        Image(systemName: cycle == program.currentCycle ? "mappin.and.ellipse" : "arrow.right")
                            .frame(width: 24)
                        Text(program.cycleLabel(cycle)).font(AppFont.headline())
                        Spacer()
                        Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary)
                    }
                    .contentShape(Rectangle())
                }
                .foregroundStyle(Theme.textPrimary)
                .listRowBackground(Theme.surface)
                .accessibilityAddTraits(cycle == program.currentCycle ? .isSelected : [])
            }
            .scrollContentBackground(.hidden)
            .background(Theme.surface)
            .navigationTitle("Go to...")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
