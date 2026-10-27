import SwiftUI

/// Customize Sections (`workout-tab-09-customize-sections.jpg`): Default Sections in tab order with Active Program's
/// on/off toggle, then the custom sections in the order the Your Sections slot draws them. Both reorder by drag, and +
/// adds a section.
struct CustomizeSectionsView: View {
    @Observe(AppSettings.current) private var settings
    @Environment(LocalStore.self) private var store
    @State private var addingSection = false

    var body: some View {
        let layout = settings.workout.sections
        List {
            ThemedSection("Default Sections") {
                ForEach(layout.order) { section in
                    HStack(spacing: 14) {
                        Image(systemName: section.icon).frame(width: 24).accessibilityHidden(true)
                        Text(section.title).font(AppFont.rowTitle)
                        Spacer()
                        if section == .activeProgram {
                            Toggle("Show Active Program", isOn: Binding(
                                get: { layout.showsActiveProgram },
                                set: { shows in store.updateSettings { $0.workout.sections.showsActiveProgram = shows } }
                            ))
                            .labelsHidden()
                            .tint(Theme.accent)
                        }
                    }
                }
                .onMove { from, to in store.updateSettings { $0.workout.sections.order.move(fromOffsets: from, toOffset: to) } }
            }
            ThemedSection("Your Sections", footer: "Drag to reorder. Your sections appear on the Workout tab where the Your Sections row sits.") {
                if layout.custom.isEmpty { NoSectionsLabel() }
                ForEach(layout.custom) { section in
                    Text(section.name).font(AppFont.rowTitle)
                }
                .onMove { from, to in store.updateSettings { $0.workout.sections.custom.move(fromOffsets: from, toOffset: to) } }
            }
        }
        .environment(\.editMode, .constant(.active))
        .themedList()
        .detailTitle("Customize Sections")
        .toolbar {
            ToolbarItem {
                Button("New Section", systemImage: "plus") { addingSection = true }
            }
        }
        .newSectionAlert(isPresented: $addingSection)
    }
}
