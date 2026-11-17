import Feedback
import SwiftUI

/// The supplement screens, pushed as values from More and the Food Log, which register `destination` at their roots.
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

/// The supplement library: a tile per pill, the ones being taken first. A tile opens its page, and + adds one.
struct SupplementsView: View {
    @Observe(Supplement.all) private var supplements
    @State private var creating = false
    @State private var sections = ViewMemo<SectionsKey, Sections>()

    private struct SectionsKey: Equatable {
        let supplements: [Supplement]
        let today: CalendarDay
    }

    private struct Sections {
        var taking: [Supplement] = []
        var stopped: [Supplement] = []
    }

    private static let columns = Array(repeating: GridItem(.flexible(), spacing: 12, alignment: .top), count: 3)

    var body: some View {
        let today = CalendarDay.today
        let sections = self.sections(SectionsKey(supplements: supplements, today: today)) {
            supplements.reduce(into: Sections()) { sections, supplement in
                if supplement.status(on: today) == .stopped { sections.stopped.append(supplement) } else { sections.taking.append(supplement) }
            }
        }
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                grid("Taking", sections.taking, today: today)
                grid("Not Taking", sections.stopped, today: today)
            }
            .padding(.horizontal, Theme.margin)
            .padding(.vertical, 12)
        }
        .background(Theme.background)
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
    private func grid(_ title: String, _ supplements: [Supplement], today: CalendarDay) -> some View {
        if !supplements.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader(title)
                LazyVGrid(columns: Self.columns, spacing: 16) {
                    ForEach(supplements) { supplement in
                        NavigationLink(value: SupplementRoute.detail(supplement.id, day: nil)) {
                            SupplementTile(supplement: supplement, caption: SupplementFormat.status(supplement, on: today))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .feedback(title)
        }
    }
}

/// A square picture over the supplement's name and how it is taken.
private struct SupplementTile: View {
    let supplement: Supplement
    let caption: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            SupplementPicture(supplement, cornerRadius: Theme.cornerRadius).aspectRatio(1, contentMode: .fit)
            VStack(alignment: .leading, spacing: 2) {
                Text(supplement.name).font(AppFont.rowTitle).foregroundStyle(Theme.textPrimary).lineLimit(2)
                Text(caption).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary).lineLimit(2)
            }
            .multilineTextAlignment(.leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
        .feedback(self)
    }
}

extension SupplementFormat {
    /// A library tile's line: how it is taken now, when it starts, or when it stopped.
    static func status(_ supplement: Supplement, on today: CalendarDay) -> String {
        guard let index = supplement.currentRegimen(on: today) else {
            return supplement.regimens.last?.end.map { "Stopped \(StrategyFormat.day($0, year: $0.year != today.year))" } ?? "Not taking"
        }
        let regimen = supplement.regimens[index]
        return regimen.start > today
            ? "Starts \(StrategyFormat.day(regimen.start, year: regimen.start.year != today.year))"
            : schedule(regimen, of: supplement.serving)
    }
}
