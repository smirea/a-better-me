import SwiftUI

/// Customize Sections (`workout-tab-09-customize-sections.jpg`): the three sections in tab order, reordered by drag,
/// with Active Program's on/off toggle.
struct CustomizeSectionsView: View {
    @AppStorage(WorkoutSectionsLayout.storageKey) private var storage = ""

    var body: some View {
        let layout = WorkoutSectionsLayout(storage: storage)
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
                                set: { shows in update { $0.showsActiveProgram = shows } }
                            ))
                            .labelsHidden()
                            .tint(Theme.accent)
                        }
                    }
                    .listRowBackground(Theme.surface)
                }
                .onMove { from, to in update { $0.order.move(fromOffsets: from, toOffset: to) } }
            } header: {
                Text("Sections").font(AppFont.title(18)).foregroundStyle(Theme.textPrimary).textCase(nil)
            } footer: {
                Text("Drag to reorder. You haven’t added new sections yet; custom sections are not available.")
            }
        }
        .environment(\.editMode, .constant(.active))
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("Customize Sections")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func update(_ change: (inout WorkoutSectionsLayout) -> Void) {
        var layout = WorkoutSectionsLayout(storage: storage)
        change(&layout)
        storage = layout.storage
    }
}
