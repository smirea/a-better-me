import SwiftUI

/// The Instructions · Details · History sheet. `action` adds the bottom button ("Add Exercise" from the picker).
struct ExerciseDetailSheet: View {
    let exerciseID: ExerciseID
    var action: (label: String, perform: () -> Void)?
    @Environment(ExerciseCatalog.self) private var catalog
    @Environment(\.dismiss) private var dismiss
    @State private var tab = DetailTab.instructions

    enum DetailTab: String, CaseIterable, Identifiable {
        case instructions = "Instructions", details = "Details", history = "History"
        var id: Self { self }
    }

    var body: some View {
        NavigationStack {
            Group {
                if let exercise = catalog.exercise(exerciseID) {
                    ScrollView {
                        switch tab {
                        case .instructions: InstructionsTab(exercise: exercise)
                        case .details: DetailsTab(exercise: exercise)
                        case .history: ExerciseHistoryTab(exercise: exercise)
                        }
                    }
                    .safeAreaBar(edge: .top) {
                        Picker("Section", selection: $tab) {
                            ForEach(DetailTab.allCases) { Text($0.rawValue).tag($0) }
                        }
                        .pickerStyle(.segmented)
                        .padding(.horizontal)
                        .padding(.bottom, 8)
                    }
                    .navigationTitle(exercise.name)
                } else {
                    ContentUnavailableView("Exercise not found", systemImage: "questionmark.circle")
                }
            }
            .background(Theme.background)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                if let action {
                    Button(action.label) {
                        action.perform()
                        dismiss()
                    }
                    .primaryPill()
                    .padding(.horizontal)
                }
            }
        }
    }
}

/// The poster frames stand in for MF's video, which it streams behind Firebase App Check (see docs/decisions/workouts.md).
/// The thumbnails on the right switch frames the way MF's switch camera angles.
private struct InstructionsTab: View {
    let exercise: Exercise
    @Environment(ExerciseCatalog.self) private var catalog
    @State private var frame = 0
    @State private var content: InstructionSource.Content?

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            if !exercise.images.isEmpty {
                ExerciseImage(exercise: exercise, frame: frame)
                    .frame(maxWidth: .infinity)
                    .frame(height: 420)
                    .clipped()
                    .overlay(alignment: .topTrailing) {
                        if exercise.images.count > 1 {
                            VStack(spacing: 8) {
                                ForEach(exercise.images.indices, id: \.self) { index in
                                    Button { frame = index } label: {
                                        ExerciseImage(exercise: exercise, frame: index)
                                            .frame(width: 40, height: 60)
                                            .clipShape(.rect(cornerRadius: 6))
                                            .overlay {
                                                RoundedRectangle(cornerRadius: 6)
                                                    .strokeBorder(index == frame ? Theme.textPrimary : .clear, lineWidth: 2)
                                            }
                                    }
                                    .accessibilityLabel("Frame \(index + 1)")
                                }
                            }
                            .padding(10)
                        }
                    }
                    .clipShape(.rect(cornerRadius: Theme.smallCornerRadius))
            }
            if let content = content?.source == source ? content : nil {
                if content.sections.isEmpty && exercise.articleIDs.isEmpty {
                    Text("No instructions for this exercise.").foregroundStyle(Theme.textSecondary)
                }
                ForEach(content.sections) { CollapsibleSection(section: $0, startsExpanded: true) }
                ForEach(content.articles) { CollapsibleSection(section: $0, startsExpanded: false) }
            }
        }
        .padding()
        .task(id: source) { content = await source.load() }
    }

    /// Resolving the URLs here re-renders the tab when `AssetStore` downloads a missing file.
    private var source: InstructionSource {
        InstructionSource(
            about: exercise.isCustom ? exercise.about ?? "" : nil,
            instructions: exercise.isCustom ? nil : catalog.instructionsURL(for: exercise),
            articles: exercise.articleIDs.compactMap { catalog.articles[$0] }.map { .init(title: $0.title, url: catalog.articleURL($0)) }
        )
    }
}

/// The files an exercise's Instructions tab shows, read and parsed off main.
struct InstructionSource: Hashable, Sendable {
    struct ArticleFile: Hashable, Sendable {
        let title: String
        let url: URL?
    }

    /// A custom exercise's own description, which replaces the instructions file.
    let about: String?
    let instructions: URL?
    let articles: [ArticleFile]

    struct Content {
        let source: InstructionSource
        let sections: [MarkdownSection]
        /// One section per article whose file is on disk.
        let articles: [MarkdownSection]
    }

    @concurrent func load() async -> Content {
        let markdown = about ?? instructions.flatMap(Self.read) ?? ""
        return Content(
            source: self,
            sections: MarkdownSection.parse(markdown).map { $0.title.isEmpty ? MarkdownSection(title: "Description", body: $0.body) : $0 },
            articles: articles.compactMap { article in
                article.url.flatMap(Self.read).map { MarkdownSection(title: article.title, body: $0) }
            }
        )
    }

    private static func read(_ url: URL) -> String? { try? String(contentsOf: url, encoding: .utf8) }
}

private struct CollapsibleSection: View {
    let section: MarkdownSection
    @State private var isExpanded: Bool

    init(section: MarkdownSection, startsExpanded: Bool) {
        self.section = section
        _isExpanded = State(initialValue: startsExpanded)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                SectionTitle(section.title)
                Spacer()
                Button(isExpanded ? "Collapse" : "Expand") { withAnimation { isExpanded.toggle() } }
                    .font(AppFont.medium(13))
                    .underline()
                    .foregroundStyle(Theme.textPrimary)
            }
            if isExpanded { MarkdownBlocks(markdown: section.body) }
        }
    }
}

private struct DetailsTab: View {
    let exercise: Exercise
    @Environment(ExerciseCatalog.self) private var catalog

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 12) {
                SectionTitle("Target Muscles")
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(exercise.primaryMuscles) { TargetMuscleCard(muscle: $0, role: "Primary") }
                        ForEach(exercise.secondaryMuscles) { TargetMuscleCard(muscle: $0, role: "Secondary") }
                    }
                }
                .scrollIndicators(.hidden)
            }
            if exercise.rangeOfMotion != nil || exercise.stability != nil {
                VStack(alignment: .leading, spacing: 4) {
                    SectionTitle("Properties")
                    if let rom = exercise.rangeOfMotion { RatingRow(title: "Range of Motion", value: rom) }
                    if let stability = exercise.stability { RatingRow(title: "Stability", value: stability) }
                }
            }
            EquipmentOptions(title: "Resistance Equipment", names: exercise.resistanceEquipment, ids: exercise.resistanceEquipmentIDs)
            EquipmentOptions(title: "Support Equipment", names: exercise.supportEquipment, ids: exercise.supportEquipmentIDs)
            VStack(alignment: .leading, spacing: 0) {
                SectionTitle("Details").padding(.bottom, 8)
                ForEach(details, id: \.title) { item in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.title).font(AppFont.medium(14))
                        Text(item.value).font(AppFont.caption(13)).foregroundStyle(Theme.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 10)
                    Divider().overlay(Theme.separator)
                }
            }
        }
        .padding()
    }

    private var details: [(title: String, value: String)] {
        let rows: [(String, String)] = [
            ("Alternative Names", exercise.alternativeNames.joined(separator: ", ")),
            ("Type", exercise.restCategory.displayName),
            ("Body Weight Contribution", exercise.bodyweightFraction > 0 ? (exercise.bodyweightFraction).formatted(.percent.precision(.fractionLength(0))) : ""),
            ("Metrics", exercise.metricsLine),
            ("Laterality", exercise.laterality.displayName),
            ("Primary Joint Action", exercise.primaryJointActions.joined(separator: ", ")),
            ("Secondary Joint Action", exercise.secondaryJointActions.joined(separator: ", ")),
        ]
        return rows.filter { !$0.1.isEmpty }
    }
}

struct TargetMuscleCard: View {
    let muscle: Muscle
    let role: String

    var body: some View {
        HStack(spacing: 10) {
            MuscleTile(muscle: muscle).frame(width: 52, height: 52)
            VStack(alignment: .leading, spacing: 2) {
                Text(muscle.displayName).font(AppFont.medium(14))
                Text(role).font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
            }
            .padding(.trailing, 12)
        }
        .padding(4)
        .background(Theme.surface, in: .rect(cornerRadius: Theme.smallCornerRadius))
        .overlay { RoundedRectangle(cornerRadius: Theme.smallCornerRadius).strokeBorder(Theme.surfaceRaised) }
    }
}

private struct RatingRow: View {
    let title: String
    let value: Int

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(AppFont.medium(14))
                Text("\(value)/5").font(AppFont.caption(12)).foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            RatingBar(value: value)
        }
        .padding(.vertical, 8)
    }
}

struct EquipmentOptions: View {
    let title: String
    let names: [String]
    let ids: [[String]]
    @Environment(ExerciseCatalog.self) private var catalog

    /// The reference names an option by its equipment ("Flat Bench, Power Rack") rather than the group's own name.
    private func optionName(_ index: Int, fallback: String) -> String {
        let names = (ids[safe: index] ?? []).compactMap { catalog.equipment[$0]?.name }
        return names.isEmpty ? fallback : names.joined(separator: ", ")
    }

    var body: some View {
        if !names.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                if !title.isEmpty { SectionTitle(title) }
                ForEach(Array(names.enumerated()), id: \.offset) { index, name in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            ForEach(ids[safe: index] ?? [], id: \.self) { EquipmentImage(equipmentID: $0).frame(width: 32, height: 32) }
                        }
                        Text(optionName(index, fallback: name)).font(AppFont.medium(14))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .overlay { RoundedRectangle(cornerRadius: Theme.smallCornerRadius).strokeBorder(Theme.surfaceRaised) }
                }
            }
        }
    }
}
