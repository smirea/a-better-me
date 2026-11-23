import Feedback
import SwiftUI

/// Settings > General > Changelog: one section per day, newest first, under a centered title between two rules. Entries
/// draw straight on the page, without the usual card, as the owner asked: a build and time line, the title across the
/// full width, the description, and a link per task, named after it.
struct ChangelogView: View {
    @State private var loaded: (build: String, days: [Changelog.Day])?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                if let loaded {
                    ForEach(loaded.days) { day in
                        DayHeader(title: day.title)
                        ForEach(day.entries) { entry in
                            if entry.id != day.entries.first?.id {
                                Divider().overlay(Theme.separator).padding(.horizontal, Theme.margin)
                            }
                            ChangelogRow(entry: entry)
                        }
                    }
                }
            }
            .padding(.bottom, 24)
        }
        .background(Theme.background)
        .detailTitle("Changelog", subtitle: loaded?.build)
        .task { loaded = await Changelog.bundled() }
        .feedback(self)
    }
}

private struct DayHeader: View {
    let title: String

    var body: some View {
        HStack(spacing: 12) {
            rule
            Text(title).font(AppFont.listTitle).foregroundStyle(Theme.textPrimary).fixedSize()
            rule
        }
        .padding(.top, 28)
        .padding(.bottom, 4)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
        .feedback("\(title) Header")
    }

    private var rule: some View {
        Rectangle().fill(Theme.textTertiary.opacity(0.5)).frame(height: 1).frame(maxWidth: .infinity)
    }
}

private struct ChangelogRow: View {
    let entry: Changelog.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            BuildLine(entry: entry)
            Text(entry.title).font(AppFont.rowTitle).foregroundStyle(Theme.textPrimary)
            if let description = entry.description {
                Text(description).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
            }
            TaskLinks(tasks: entry.tasks).padding(.top, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Theme.margin)
        .padding(.vertical, 12)
        .feedback("Changelog Entry", data: entry.id)
    }
}

/// The build that first shipped the entry, then when it was archived in local time. The build number stays whole,
/// since it is the name TestFlight and the screen's subtitle use, and its own digits are a UTC time. A build archived
/// on a later local day than the entry also names that day.
private struct BuildLine: View {
    let entry: Changelog.Entry

    var body: some View {
        HStack {
            Text(entry.build)
            Spacer()
            if let time = entry.buildTimeLabel { Text(time) }
        }
        .font(AppFont.caption(11))
        .monospacedDigit()
        .foregroundStyle(Theme.textTertiary)
        .accessibilityElement(children: .combine)
    }
}

/// One line per task, its title cut to a single line. Nothing without a task.
private struct TaskLinks: View {
    let tasks: [Changelog.TaskLink]

    var body: some View {
        if !tasks.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                ForEach(tasks) { task in
                    Link(destination: task.url) {
                        Label(task.label, systemImage: "checklist")
                            .lineLimit(1)
                            .truncationMode(.tail)
                    }
                    .accessibilityLabel("Open \(task.label) in ProcrastiMate")
                }
            }
            .font(AppFont.rowDetail)
            .foregroundStyle(Theme.textSecondary)
        }
    }
}
