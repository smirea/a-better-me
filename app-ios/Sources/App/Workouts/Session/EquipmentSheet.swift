import SwiftUI

/// The live workout's Equipment chip: which resistance option and which support option this exercise uses, as in
/// `m2-live-equipment-chip`. Options the session's gym lacks are dimmed with MF's "Option N not available in your
/// gym" and can't be picked. The header's sliders button opens the exercise's equipment settings.
struct EquipmentSheet<Settings: View>: View {
    let exercise: Exercise
    let availability: GymAvailability?
    @Binding var choice: [EquipmentID]?
    @Binding var support: [EquipmentID]?
    @ViewBuilder let settings: () -> Settings
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(\.dismiss) private var dismiss
    @State private var showingSettings = false

    var body: some View {
        let chosen = exercise.chosenEquipment(choice, in: availability)
        let chosenSupport = exercise.chosenSupport(support, in: availability)
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Resistance").font(AppFont.headline(16))
                    ForEach(exercise.resistanceOptions(in: availability)) { option in
                        row(option, isSelected: option.ids == chosen) { choice = option.ids }
                    }
                    let supports = exercise.supportOptions(in: availability)
                    if !supports.isEmpty {
                        Text("Support").font(AppFont.headline(16)).padding(.top, 10)
                        ForEach(supports) { option in
                            row(option, isSelected: option.ids == chosenSupport) { support = option.ids }
                        }
                    }
                }
                .padding(20)
            }
            .background(Theme.background)
            .detailTitle("Equipment")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Equipment Settings", systemImage: "slider.horizontal.3") { showingSettings = true }
                }
            }
            .navigationDestination(isPresented: $showingSettings) { settings() }
            .safeAreaInset(edge: .bottom) {
                PinnedActionButton("Done") { dismiss() }
            }
        }
    }

    private func row(_ option: EquipmentChoiceOption, isSelected: Bool, select: @escaping () -> Void) -> some View {
        let items = Loading.itemsLoaded(by: option.ids, catalog: catalog.equipment)
        let name = items.compactMap { catalog.equipment[$0]?.name }.joined(separator: ", ")
        return Button(action: select) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 6) {
                        ForEach(items, id: \.self) { EquipmentImage(equipmentID: $0).frame(width: 28, height: 28) }
                    }
                    Text(name).font(AppFont.medium(15)).multilineTextAlignment(.leading)
                    if !option.isAvailable {
                        Text(option.unavailableLabel).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
                    }
                }
                Spacer()
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle").font(.title3)
            }
            .foregroundStyle(Theme.textPrimary)
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.smallCornerRadius))
            .overlay {
                RoundedRectangle(cornerRadius: Theme.smallCornerRadius)
                    .strokeBorder(isSelected ? Theme.textPrimary : Theme.separator, lineWidth: isSelected ? 2 : 1)
            }
            .opacity(option.isAvailable ? 1 : 0.45)
        }
        .disabled(!option.isAvailable)
        .accessibilityLabel(option.isAvailable ? name : "\(name), \(option.unavailableLabel)")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
