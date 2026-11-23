import Feedback
import SwiftUI

/// The supplement screens, pushed as values from Settings and the Food Log, which register `destination` at their roots.
enum SupplementRoute: Hashable {
    case library
    /// `day` is the Food Log day it was opened from, whose amounts the page shows.
    case detail(UUID, day: CalendarDay?)

    @ViewBuilder
    var destination: some View {
        switch self {
        case .library: SupplementsView()
        case let .detail(id, day): SupplementDetailView(supplementID: id, day: day)
        }
    }
}

/// The supplement library: a row per pill, the ones being taken first, with its picture, name, and the dates of its
/// latest regimen. A row opens its page, and + adds one.
struct SupplementsView: View {
    @Observe(Supplement.all) private var supplements
    @State private var creating = false
    @State private var sections = ViewMemo<SectionsKey, Sections>()

    private struct SectionsKey: Equatable {
        let supplements: [Supplement]
        let today: CalendarDay
    }

    private struct Sections {
        var taking: [SupplementRow.Item] = []
        var stopped: [SupplementRow.Item] = []
    }

    var body: some View {
        let today = CalendarDay.today
        let sections = self.sections(SectionsKey(supplements: supplements, today: today)) {
            supplements.reduce(into: Sections()) { sections, supplement in
                let item = SupplementRow.Item(supplement: supplement, range: SupplementFormat.range(supplement, on: today))
                if supplement.status(on: today) == .stopped { sections.stopped.append(item) } else { sections.taking.append(item) }
            }
        }
        List {
            section("Taking", sections.taking)
            section("Not Taking", sections.stopped)
        }
        .flatList()
        .overlay {
            if supplements.isEmpty {
                ContentUnavailableView {
                    Label("No Supplements", systemImage: "pills")
                } description: {
                    Text("Add the pills you take, and each day in the Food Log shows them.")
                } actions: {
                    Button("New Supplement") { creating = true }.secondaryPill().fixedSize()
                }
            }
        }
        .detailTitle("Supplements")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("New Supplement", systemImage: "plus") { creating = true }
            }
        }
        .sheet(isPresented: $creating) { SupplementEditor() }
        .feedback(self)
    }

    @ViewBuilder
    private func section(_ title: String, _ items: [SupplementRow.Item]) -> some View {
        if !items.isEmpty {
            ThemedSection(title) {
                ForEach(items) { item in
                    NavigationLink(value: SupplementRoute.detail(item.id, day: nil)) { SupplementRow(item: item) }
                        .accessibilityIdentifier("supplement-\(item.supplement.name)")
                }
            }
            .feedback(title)
        }
    }
}

/// The supplement's picture beside its name, over its range when it has one.
private struct SupplementRow: View {
    struct Item: Identifiable, Equatable {
        let supplement: Supplement
        let range: String?

        var id: UUID { supplement.id }
    }

    let item: Item
    @ScaledMetric private var pictureSize: CGFloat = 44

    var body: some View {
        HStack(spacing: 12) {
            SupplementPicture(item.supplement).frame(width: pictureSize, height: pictureSize)
            RowLabel(title: item.supplement.name, detail: item.range)
        }
        .feedback(self)
    }
}
