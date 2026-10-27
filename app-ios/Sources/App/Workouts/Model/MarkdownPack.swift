import Foundation

/// The catalog's instruction and article Markdown, bundled as `markdown.pack` (the UTF-8 texts back to back) and
/// `markdown.json` (each key's byte offset and size), as `scripts/markdown-pack.ts` writes them. Lookups are by key
/// only, so a memory-mapped file and an index beat a database: only the pages of the texts read are loaded.
struct MarkdownPack: Sendable {
    /// Loaded on first use, which is off main when `InstructionSource.load` reads it.
    static let bundled = MarkdownPack(bundle: .main)

    private let data: Data
    private let ranges: [String: [Int]]

    init(data: Data, ranges: [String: [Int]]) {
        self.data = data
        self.ranges = ranges
    }

    private init(bundle: Bundle) {
        guard let pack = bundle.url(forResource: "markdown", withExtension: "pack"),
              let index = bundle.url(forResource: "markdown", withExtension: "json") else {
            fatalError("Missing markdown.pack or markdown.json. Regenerate them with `bun app-ios/scripts/catalog.ts`.")
        }
        do {
            self.init(
                data: try Data(contentsOf: pack, options: .alwaysMapped),
                ranges: try JSONDecoder().decode([String: [Int]].self, from: Data(contentsOf: index))
            )
        } catch {
            fatalError("markdown.pack or markdown.json is unreadable: \(error)")
        }
    }

    func instructions(_ exerciseID: ExerciseID) -> String? { text("Instructions/\(exerciseID)") }

    func article(_ articleID: String) -> String? { text("Articles/\(articleID)") }

    private func text(_ key: String) -> String? {
        guard let range = ranges[key], range.count == 2, range[0] >= 0, range[1] >= 0,
              range[0] + range[1] <= data.count else { return nil }
        return String(decoding: data[range[0]..<range[0] + range[1]], as: UTF8.self)
    }
}
