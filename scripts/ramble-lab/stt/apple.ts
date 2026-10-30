import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { SttEvent } from '../types';

const source = String.raw`
import AVFoundation
import Foundation
import Speech

@main struct Transcribe {
 static func main() async throws {
  let args = Array(CommandLine.arguments.dropFirst())
  let hints = try String(contentsOfFile: args[0], encoding: .utf8).split(separator: "\n").map(String.init)
  guard let locale = await SpeechTranscriber.supportedLocale(equivalentTo: Locale(identifier: "en-US")) else {
   throw NSError(domain: "STT", code: 1, userInfo: [NSLocalizedDescriptionKey: "en-US unsupported"])
  }
  let module = SpeechTranscriber(locale: locale, transcriptionOptions: [], reportingOptions: [.volatileResults], attributeOptions: [.audioTimeRange])
  if let request = try await AssetInventory.assetInstallationRequest(supporting: [module]) { try await request.downloadAndInstall() }
  let analyzer = SpeechAnalyzer(modules: [module])
  if !hints.isEmpty {
   let context = AnalysisContext()
   context.contextualStrings[.general] = hints
   try await analyzer.setContext(context)
  }
  let audio = try AVAudioFile(forReading: URL(fileURLWithPath: args[1]))
  let start = ContinuousClock.now
  let reader = Task {
   for try await result in module.results {
    let elapsed = start.duration(to: .now)
    let lag = Double(elapsed.components.seconds) * 1000 + Double(elapsed.components.attoseconds) / 1e15
    let row: [String: Any] = ["kind": result.isFinal ? "final" : "partial", "text": String(result.text.characters), "audioStart": CMTimeGetSeconds(result.range.start) * 1000, "audioEnd": CMTimeGetSeconds(CMTimeRangeGetEnd(result.range)) * 1000, "processingMs": lag]
    let json = try JSONSerialization.data(withJSONObject: row)
    print(String(data: json, encoding: .utf8)!)
   }
  }
  if let last = try await analyzer.analyzeSequence(from: audio) { try await analyzer.finalizeAndFinish(through: last) }
  else { await analyzer.cancelAndFinishNow() }
  try await reader.value
 }
}
`;
let built: Promise<string> | undefined;
async function build() {
	const folder = resolve('.cache/ramble-lab/stt');
	await mkdir(folder, { recursive: true });
	const swift = `${folder}/transcribe.swift`;
	const binary = `${folder}/transcribe`;
	const unchanged = (await Bun.file(swift).exists()) && (await Bun.file(swift).text()) === source;
	if (unchanged && (await Bun.file(binary).exists())) return binary;
	await Bun.write(swift, source);
	const p = Bun.spawn(['xcrun', 'swiftc', '-parse-as-library', '-O', swift, '-o', binary], {
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const [code, stderr] = await Promise.all([p.exited, new Response(p.stderr).text()]);
	if (code) throw new Error(`Swift build failed: ${stderr}`);
	return binary;
}
export async function apple(file: string, hints: string[], duration: number) {
	const binary = await (built ??= build());
	const hintFile = resolve(`.cache/ramble-lab/stt/apple-hints${hints.length ? '-keyterms' : ''}.txt`);
	await Bun.write(hintFile, hints.join('\n'));
	const p = Bun.spawn([binary, hintFile, file], { stdout: 'pipe', stderr: 'pipe' });
	const [code, stdout, stderr] = await Promise.all([
		p.exited,
		new Response(p.stdout).text(),
		new Response(p.stderr).text(),
	]);
	if (code) throw new Error(`SpeechAnalyzer failed: ${stderr}`);
	const rows = stdout
		.trim()
		.split('\n')
		.filter(Boolean)
		.map(line => JSON.parse(line));
	let last = 0;
	// Offline analysis has no microphone clock. Add elapsed analysis work to each range end, then preserve arrival order.
	// This estimates a serial real-time replay; it is not measured live microphone latency.
	const events: SttEvent[] = rows.map(row => ({
		at: (last = Math.max(last, row.audioEnd + row.processingMs)),
		kind: row.kind,
		text: row.text.trim(),
	}));
	return {
		events,
		audioEndAt: Math.max(0, duration - Math.min(100, duration % 100 || 100)),
		doneAt: Math.max(duration, last),
		rows,
	};
}
