import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { DEV } from './food-ramble/cases';
import { MEALS, USUAL } from './food-ramble/history';
import { HOLDOUT } from './food-ramble/holdout';

/**
 * Speaks every labelled ramble with macOS `say` and transcribes it with the on-device recognizer the phone uses
 * (SpeechAnalyzer), with its DictationTranscriber and its SpeechTranscriber, each without and with the owner's food
 * names as contextual strings. Feed a result to the eval with `--transcripts`, so the score includes real speech-to-text errors.
 *
 *   bun scripts/food-ramble-speech.ts [--voices Samantha,Eddy] → .cache/food-ramble/<voice>-<transcriber>[-hints].json
 */

const { values } = parseArgs({ options: { voices: { type: 'string', default: 'Samantha' } } });
const root = join(import.meta.dir, '..');
const cache = join(root, '.cache/food-ramble');
mkdirSync(cache, { recursive: true });

const source = join(import.meta.dir, 'food-ramble/transcribe.swift');
const tool = join(cache, 'transcribe');
if (!existsSync(tool) || statSync(tool).mtimeMs < statSync(source).mtimeMs) {
	const build = Bun.spawnSync(['swiftc', '-O', '-parse-as-library', '-o', tool, source], { stderr: 'inherit' });
	if (build.exitCode !== 0) throw new Error('swiftc failed');
}

const hints = [...new Set([...MEALS.flatMap(meal => meal.entries), ...USUAL].map(entry => entry.name))];
const hintsFile = join(cache, 'hints.txt');
writeFileSync(hintsFile, hints.join('\n'));

const cases = [...DEV, ...HOLDOUT];
for (const voice of values.voices.split(',')) {
	const dir = join(cache, voice.replace(/\W+/g, '-'));
	mkdirSync(dir, { recursive: true });
	const files = cases.map(c => {
		const file = join(dir, `${c.id}.aiff`);
		if (!existsSync(file)) {
			const said = Bun.spawnSync(['say', '-v', voice, '-o', file, c.text]);
			if (said.exitCode !== 0) throw new Error(`say failed for ${c.id}: ${said.stderr}`);
		}
		return file;
	});
	for (const [label, transcriber, hintsArg] of [
		['dictation', 'dictation', '-'],
		['dictation-hints', 'dictation', hintsFile],
		['speech', 'speech', '-'],
		['speech-hints', 'speech', hintsFile],
	] as const) {
		const run = Bun.spawnSync([tool, hintsArg, ...files], {
			stderr: 'inherit',
			env: { ...process.env, TRANSCRIBER: transcriber },
		});
		if (run.exitCode !== 0) throw new Error(`transcribe failed (${voice}, ${label})`);
		const texts = Object.fromEntries(
			run.stdout
				.toString()
				.trim()
				.split('\n')
				.map(line => JSON.parse(line) as { file: string; text: string })
				.map(({ file, text }) => [
					file
						.split('/')
						.at(-1)!
						.replace(/\.aiff$/, ''),
					text,
				]),
		);
		const out = join(cache, `${voice.replace(/\W+/g, '-')}-${label}.json`);
		writeFileSync(out, `${JSON.stringify(texts, null, '\t')}\n`);
		const changed = cases.filter(c => texts[c.id]?.toLowerCase() !== c.text.toLowerCase()).length;
		console.log(`${out}: ${Object.keys(texts).length} transcripts, ${changed} differ from the typed text`);
	}
}
