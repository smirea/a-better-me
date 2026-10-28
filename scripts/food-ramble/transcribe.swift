import AVFoundation
import Foundation
import Speech

/// `transcribe <hints-file|-> <audio>...` prints one JSON line per file, `{"file", "text"}`. `TRANSCRIBER=speech`
/// uses SpeechTranscriber instead of the DictationTranscriber the phone runs.
@main
struct Transcribe {
    static func main() async throws {
        let args = Array(CommandLine.arguments.dropFirst())
        let hints = args[0] == "-" ? [] : try String(contentsOfFile: args[0], encoding: .utf8).split(separator: "\n").map(String.init)
        guard let locale = await DictationTranscriber.supportedLocale(equivalentTo: Locale(identifier: "en-US")) else {
            fatalError("en-US dictation is unsupported")
        }
        let speech = ProcessInfo.processInfo.environment["TRANSCRIBER"] == "speech"
        for file in args.dropFirst() {
            let text = speech
                ? try await transcribe(file, hints, SpeechTranscriber(locale: locale, transcriptionOptions: [], reportingOptions: [], attributeOptions: []), \.results) { ($0.isFinal, String($0.text.characters)) }
                : try await transcribe(file, hints, DictationTranscriber(locale: locale, contentHints: [], transcriptionOptions: [.punctuation], reportingOptions: [], attributeOptions: []), \.results) { ($0.isFinal, String($0.text.characters)) }
            let line = try JSONSerialization.data(withJSONObject: ["file": file, "text": text.trimmingCharacters(in: .whitespaces)])
            print(String(data: line, encoding: .utf8)!)
        }
    }

    static func transcribe<Module: SpeechModule, Results: AsyncSequence>(
        _ file: String, _ hints: [String], _ module: Module, _ results: KeyPath<Module, Results>,
        _ final: @escaping @Sendable (Results.Element) -> (Bool, String)
    ) async throws -> String where Results: Sendable {
        if let request = try await AssetInventory.assetInstallationRequest(supporting: [module]) {
            try await request.downloadAndInstall()
        }
        let audio = try AVAudioFile(forReading: URL(fileURLWithPath: file))
        let analyzer = SpeechAnalyzer(modules: [module])
        if !hints.isEmpty {
            let context = AnalysisContext()
            context.contextualStrings[.general] = hints
            try await analyzer.setContext(context)
        }
        let stream = module[keyPath: results]
        let reader = Task {
            var text = ""
            for try await result in stream {
                let (isFinal, words) = final(result)
                if isFinal { text += words }
            }
            return text
        }
        if let last = try await analyzer.analyzeSequence(from: audio) {
            try await analyzer.finalizeAndFinish(through: last)
        } else {
            await analyzer.cancelAndFinishNow()
        }
        return try await reader.value
    }
}
