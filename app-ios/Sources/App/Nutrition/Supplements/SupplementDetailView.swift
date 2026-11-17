import Feedback
import SwiftUI

/// A supplement's page: its picture, how it is taken, the Supplement Facts, and its past regimens, with Edit, Stop or
/// Start, and Delete. Opened from a Food Log day it shows that day's amounts; from the library, one serving's.
struct SupplementDetailView: View {
    private let day: CalendarDay?
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Observe private var supplement: Supplement?
    @State private var editing: Supplement?
    @State private var confirmingDelete = false

    init(supplementID: UUID, day: CalendarDay?) {
        self.day = day
        _supplement = Observe(Supplement.one(supplementID))
    }

    var body: some View {
        if let supplement {
            content(supplement).feedback(self)
        } else {
            // Deleting from here or the editor leaves this page behind; it pops once its supplement is gone.
            ContentUnavailableView("Supplement deleted", systemImage: "trash")
                .onAppear { dismiss() }
        }
    }

    private func content(_ supplement: Supplement) -> some View {
        let today = CalendarDay.today
        let status = supplement.status(on: today)
        let current = supplement.currentRegimen(on: today)
        let dayRegimen = day.flatMap(supplement.regimen(on:))
        return Form {
            ThemedSection {
                HStack(spacing: 14) {
                    SupplementPicture(supplement, cornerRadius: Theme.cornerRadius).frame(width: 96, height: 96)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(supplement.name).font(AppFont.sectionTitle)
                        if let brand = supplement.brand {
                            Text(brand).font(AppFont.body(15)).foregroundStyle(Theme.textSecondary)
                        }
                        Text(SupplementFormat.status(supplement, on: today)).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .accessibilityElement(children: .combine)
                .listRowSeparator(.hidden)
                HStack {
                    Button { editing = supplement } label: { ActionLabel(title: "Edit", systemImage: "pencil") }
                    if status == .stopped {
                        Button { store.startSupplement(supplement.id) } label: { ActionLabel(title: "Start Taking", systemImage: "play") }
                    } else {
                        Button { store.stopSupplement(supplement.id) } label: { ActionLabel(title: "Stop Taking", systemImage: "stop") }
                    }
                    Button { confirmingDelete = true } label: { ActionLabel(title: "Delete", systemImage: "trash") }
                }
                .buttonStyle(.plain)
            }
            if !supplement.components.isEmpty {
                let count = dayRegimen?.count ?? 1
                ThemedSection(
                    "Supplement Facts",
                    subtitle: "\(dayRegimen == nil ? "Per serving" : "Per day"), \(SupplementFormat.amount(supplement.serving, count: count))"
                ) {
                    ForEach(Array(supplement.components.enumerated()), id: \.offset) { _, component in
                        LabeledContent(component.name, value: SupplementFormat.component(component, count: count) ?? "")
                    }
                }
            }
            if let current {
                let regimen = supplement.regimens[current]
                ThemedSection("Regimen") {
                    LabeledContent("Amount", value: SupplementFormat.amount(supplement.serving, count: regimen.count))
                    LabeledContent("Days", value: SupplementFormat.days(regimen.weekdays))
                    LabeledContent("Time of Day", value: regimen.timing?.title ?? "Any Time")
                    LabeledContent(regimen.start > today ? "Starts" : "Since", value: StrategyFormat.day(regimen.start, year: true))
                    if let end = regimen.end {
                        LabeledContent("Last Day", value: StrategyFormat.day(end, year: true))
                    }
                }
            }
            if !supplement.note.isEmpty {
                ThemedSection("Notes") {
                    Text(supplement.note).font(AppFont.body(15))
                }
            }
            let past = PastRegimen.all(of: supplement, except: current)
            if !past.isEmpty {
                Section {
                    TruncatedList("History", items: past, inList: true) { item in
                        PastRegimenRow(item: item, serving: supplement.serving).padding(.horizontal, 16).padding(.vertical, 10)
                    } destination: {
                        SupplementHistoryView(supplementID: supplement.id)
                    }
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }
        }
        .themedList()
        .detailTitle(supplement.name)
        .sheet(item: $editing) { SupplementEditor(supplement: $0) }
        .alert("Delete Supplement", isPresented: $confirmingDelete) {
            Button("Delete", role: .destructive) {
                store.deleteSupplement(supplement.id)
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure you want to delete \(supplement.name)? It leaves every day it was on. This action cannot be undone.")
        }
    }
}

/// A regimen that is over, newest first: every one but the current.
private struct PastRegimen: Identifiable, Hashable {
    let id: Int
    let regimen: SupplementRegimen

    static func all(of supplement: Supplement, except current: Int?) -> [PastRegimen] {
        supplement.regimens.enumerated().filter { $0.offset != current }.reversed().map { PastRegimen(id: $0.offset, regimen: $0.element) }
    }
}

private struct PastRegimenRow: View {
    let item: PastRegimen
    let serving: Supplement.Serving

    var body: some View {
        RowLabel(title: StrategyFormat.range(item.regimen.start, item.regimen.end), detail: SupplementFormat.schedule(item.regimen, of: serving))
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Every past regimen of a supplement, pushed by History's See All.
private struct SupplementHistoryView: View {
    @Observe private var supplement: Supplement?

    init(supplementID: UUID) {
        _supplement = Observe(Supplement.one(supplementID))
    }

    var body: some View {
        List {
            if let supplement {
                ThemedSection {
                    ForEach(PastRegimen.all(of: supplement, except: supplement.currentRegimen(on: .today))) {
                        PastRegimenRow(item: $0, serving: supplement.serving)
                    }
                }
            }
        }
        .themedList()
        .detailTitle("History", subtitle: supplement?.name)
        .feedback(self)
    }
}
