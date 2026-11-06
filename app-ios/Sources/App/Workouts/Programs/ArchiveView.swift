import Feedback
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
                let byID = Dictionary(templates.map { ($0.id, $0) }) { first, _ in first }
                ForEach(programs) { program in
                    ProgramCard(program: program, templates: byID, accessory: .chevron)
                }
                ForEach(workouts) { template in
                    NavigationLink(value: template.id) { TemplateCard(template: template) }
                        .buttonStyle(.plain)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Theme.margin)
            .padding(.bottom)
        }
        .overlay {
            if programs.isEmpty, workouts.isEmpty {
                ContentUnavailableView("Nothing Archived", systemImage: "archivebox", description: Text("Programs and workouts you archive appear here."))
            }
        }
        .background(Theme.background)
        .detailTitle("Workout Archive")
        .feedback(self)
    }
}
