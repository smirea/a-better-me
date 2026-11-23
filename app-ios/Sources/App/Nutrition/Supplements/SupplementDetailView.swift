import Feedback
import QuickLook
import SwiftUI

/// A supplement's page: its pictures, tags, and product page, how it is taken, the Supplement Facts, and its past
/// regimens, with Edit, Stop or Start, and Delete. Opened from a Food Log day it shows that day's amounts; from the
/// library, one serving's. A picture opens all of them in Quick Look, where a label can be zoomed and read.
struct SupplementDetailView: View {
    private let day: CalendarDay?
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Observe private var supplement: Supplement?
    @Observe(Tag.byID) private var tags
    @State private var editing: Supplement?
    @State private var confirmingDelete = false
    @State private var viewing: URL?
    @State private var viewable: [URL] = []

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
                    picture(supplement.images.first, of: supplement, side: 96, cornerRadius: Theme.cornerRadius)
                    VStack(alignment: .leading, spacing: 4) {
                        if let brand = supplement.brand {
                            Text(brand).font(AppFont.body(15)).foregroundStyle(Theme.textSecondary)
                        }
                        Text(SupplementFormat.status(supplement, on: today)).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                        TagChips(tags: supplement.tags.compactMap { tags[$0] })
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityElement(children: .combine)
                }
                .listRowSeparator(.hidden)
                if supplement.images.count > 1 {
                    ScrollView(.horizontal) {
                        HStack(spacing: 8) {
                            ForEach(supplement.images.dropFirst(), id: \.self) { picture($0, of: supplement, side: 72, cornerRadius: Theme.smallCornerRadius) }
                        }
                    }
                    .scrollIndicators(.hidden)
                    .listRowSeparator(.hidden)
                }
                if let url = supplement.url.flatMap(URL.init(string:)) {
                    Link(destination: url) {
                        HStack {
                            Label("Product Page", systemImage: "safari")
                            Spacer()
                            Text(url.host() ?? url.absoluteString).foregroundStyle(Theme.textSecondary).lineLimit(1)
                            Image(systemName: "arrow.up.right").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.textSecondary)
                        }
                    }
                    .foregroundStyle(Theme.textPrimary)
                }
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
                    let regimenTags = (regimen.tags ?? []).compactMap { tags[$0] }
                    if !regimenTags.isEmpty {
                        LabeledContent("Tags") { TagChips(tags: regimenTags) }
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
        .flatList()
        .detailTitle(supplement.name)
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Button("Edit") { editing = supplement }
                Menu("Supplement Options", systemImage: "ellipsis") {
                    if status == .stopped {
                        Button("Start Taking", systemImage: "play") { store.startSupplement(supplement.id) }
                    } else {
                        Button("Stop Taking", systemImage: "stop") { store.stopSupplement(supplement.id) }
                    }
                    Button("Delete", systemImage: "trash", role: .destructive) { confirmingDelete = true }
                }
            }
        }
        .sheet(item: $editing) { SupplementEditor(supplement: $0) }
        .quickLookPreview($viewing, in: viewable)
        .alert("Delete Supplement", isPresented: $confirmingDelete) {
            Button("Delete", role: .destructive) {
                store.deleteSupplement(supplement.id)
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("It leaves every day it was on.")
        }
    }
}

extension SupplementDetailView {
    /// One of the supplement's pictures as a button that opens all of them in Quick Look, on this one.
    @ViewBuilder
    private func picture(_ image: UUID?, of supplement: Supplement, side: CGFloat, cornerRadius: CGFloat) -> some View {
        let view = SupplementPicture(image: image, name: supplement.name, cornerRadius: cornerRadius).frame(width: side, height: side)
        if let image {
            Button {
                Task {
                    let files = await SupplementPictures.files(of: supplement.images, named: supplement.name)
                    guard let opened = files.first(where: { $0.id == image }) else { return }
                    viewable = files.map(\.url)
                    viewing = opened.url
                }
            } label: { view }
                .buttonStyle(.plain)
                .accessibilityLabel(supplement.images.count > 1 ? "Photo \((supplement.images.firstIndex(of: image) ?? 0) + 1) of \(supplement.images.count)" : "Photo")
                .accessibilityHint("Opens the photos")
        } else {
            view
        }
    }
}

/// A supplement's or a regimen's tags, each a dot in its color beside its name. Nothing when there are none.
private struct TagChips: View {
    let tags: [Tag]

    var body: some View {
        if !tags.isEmpty {
            HStack(spacing: 6) {
                ForEach(tags) { tag in
                    HStack(spacing: 5) {
                        Circle().fill(tag.swatch).frame(width: 8, height: 8)
                        Text(tag.name).font(AppFont.badge).foregroundStyle(Theme.textPrimary).lineLimit(1)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Theme.surfaceRaised, in: .capsule)
                }
            }
            .padding(.top, 2)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Tags: \(tags.map(\.name).joined(separator: ", "))")
        }
    }
}

private extension Tag {
    /// The stored `#rrggbb`, or the accent when it is not one.
    var swatch: Color {
        guard color.hasPrefix("#"), color.count == 7, let hex = UInt32(color.dropFirst(), radix: 16) else { return Theme.accent }
        return Color(hex: hex)
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
        .flatList()
        .detailTitle("History", subtitle: supplement?.name)
        .feedback(self)
    }
}
