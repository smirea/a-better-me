import SwiftUI

/// "Workout Archive" (research spec milestone-2.md §2.6): archived programs as cards with their days, then archived
/// workouts in the library row style. Pushed on the Workout tab's stack, which owns the routes.
struct ArchiveView: View {
    @Observe(Program.archived) private var programs
    @Observe(WorkoutTemplate.archived) private var workouts
    @Observe(WorkoutTemplate.all) private var templates

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Archive").font(AppFont.title())
                if programs.isEmpty, workouts.isEmpty {
                    Text("Programs and workouts you archive appear here.")
                        .font(AppFont.caption())
                        .foregroundStyle(Theme.textSecondary)
                }
                let byID = Dictionary(templates.map { ($0.id, $0) }) { first, _ in first }
                ForEach(programs) { program in
                    ProgramCard(program: program, templates: byID, accessory: .chevron)
                }
                ForEach(workouts) { template in
                    NavigationLink(value: template.id) { TemplateCard(template: template) }
                        .buttonStyle(.plain)
                }
            }
            .padding(.horizontal)
            .padding(.bottom)
        }
        .background(Theme.background)
        .detailTitle("Workout Archive")
    }
}
