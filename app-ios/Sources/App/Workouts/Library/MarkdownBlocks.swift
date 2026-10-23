import SwiftUI

/// A `##` section of an instruction file: "Setting up", "Exercise technique", or "Description".
struct MarkdownSection: Identifiable {
    let title: String
    let body: String

    var id: String { title }

    static func parse(_ markdown: String) -> [MarkdownSection] {
        var sections: [MarkdownSection] = []
        var title = ""
        var lines: [Substring] = []
        func flush() {
            let body = lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
            if !title.isEmpty || !body.isEmpty { sections.append(MarkdownSection(title: title, body: body)) }
        }
        for line in markdown.split(separator: "\n", omittingEmptySubsequences: false) {
            if line.hasPrefix("## ") {
                flush()
                title = String(line.dropFirst(3))
                lines = []
            } else {
                lines.append(line)
            }
        }
        flush()
        return sections
    }
}

/// SwiftUI's `Text` drops Markdown's block structure, so nested numbered lists, bullets, and `###` headings are laid
/// out here line by line, with inline styling left to `AttributedString`.
struct MarkdownBlocks: View {
    let markdown: String

    private enum Block: Hashable {
        case heading(String)
        case item(marker: String, text: String, depth: Int)
        case paragraph(String)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                switch block {
                case .heading(let text):
                    Text(inline(text)).font(AppFont.headline(15)).padding(.top, 4)
                case .item(let marker, let text, let depth):
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(marker).monospacedDigit().frame(minWidth: 18, alignment: .trailing)
                        Text(inline(text))
                    }
                    .padding(.leading, CGFloat(depth) * 20)
                case .paragraph(let text):
                    Text(inline(text))
                }
            }
        }
        .font(AppFont.body(14))
        .foregroundStyle(Theme.textPrimary.opacity(0.9))
        .fixedSize(horizontal: false, vertical: true)
    }

    private var blocks: [Block] {
        markdown.split(separator: "\n").compactMap { raw in
            let indent = raw.prefix { $0 == " " || $0 == "\t" }.reduce(0) { $0 + ($1 == "\t" ? 4 : 1) }
            let line = raw.trimmingCharacters(in: .whitespaces)
            guard !line.isEmpty else { return nil }
            if line.hasPrefix("#") {
                return .heading(line.drop { $0 == "#" }.trimmingCharacters(in: .whitespaces))
            }
            if let match = line.firstMatch(of: /^(\d+\.|[-*•])\s+(.*)$/) {
                let marker = match.1 == "-" || match.1 == "*" ? "•" : String(match.1)
                return .item(marker: marker, text: String(match.2), depth: indent / 4)
            }
            return .paragraph(line)
        }
    }

    private func inline(_ text: String) -> AttributedString {
        (try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)))
            ?? AttributedString(text)
    }
}
