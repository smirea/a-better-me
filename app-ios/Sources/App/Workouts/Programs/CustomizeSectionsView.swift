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
            Section {
                ForEach(layout.order) { section in
                    HStack(spacing: 14) {
                        Image(systemName: section.icon).frame(width: 24).accessibilityHidden(true)
                        Text(section.title).font(AppFont.headline(15))
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
                    .listRowBackground(Theme.surface)
                }
                .onMove { from, to in store.updateSettings { $0.workout.sections.order.move(fromOffsets: from, toOffset: to) } }
            } header: {
                header("Default Sections")
            }
            Section {
                if layout.custom.isEmpty {
                    Label("You haven’t added new sections yet. You can add one by tapping + on this page", systemImage: "rectangle.split.1x2")
                        .font(AppFont.caption())
                        .foregroundStyle(Theme.textSecondary)
                        .listRowBackground(Theme.surface)
                }
                ForEach(layout.custom) { section in
                    Text(section.name).font(AppFont.headline(15)).listRowBackground(Theme.surface)
                }
                .onMove { from, to in store.updateSettings { $0.workout.sections.custom.move(fromOffsets: from, toOffset: to) } }
            } header: {
                header("Your Sections")
            } footer: {
                Text("Drag to reorder. Your sections appear on the Workout tab where the Your Sections row sits.")
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

    private func header(_ title: String) -> some View {
        Text(title).font(AppFont.title(18)).foregroundStyle(Theme.textPrimary).textCase(nil)
    }
}
