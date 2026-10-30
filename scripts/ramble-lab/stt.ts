import { parseArgs } from 'node:util';
import { basename, resolve, join } from 'node:path';
import { mkdir, readdir } from 'node:fs/promises';
import type { SttEngine, SttRun } from './types';
import { xai, elevenlabs } from './stt/cloud';
import { geminiTranscribe } from './stt/gemini-transcribe';

import { apple } from './stt/apple';
import { within, type Session, type Sink, type Trace } from './stt/common';

type LabSttEngine = SttEngine;
type LabSttRun = Omit<SttRun, 'engine'> & { engine: LabSttEngine };

export function readWav(bytes: Buffer): Buffer {
	if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE')
		throw new Error('Expected a RIFF WAV');
	let pcm: Buffer | undefined;
	let valid = false;
	for (let at = 12; at + 8 <= bytes.length;) {
		const size = bytes.readUInt32LE(at + 4);
		const start = at + 8;
		if (start + size > bytes.length) throw new Error('Truncated WAV chunk');
		const kind = bytes.toString('ascii', at, at + 4);
		if (kind === 'fmt ') {
			if (size < 16) throw new Error('Invalid WAV format chunk');
			valid =
				bytes.readUInt16LE(start) === 1 &&
				bytes.readUInt16LE(start + 2) === 1 &&
				bytes.readUInt32LE(start + 4) === 16000 &&
				bytes.readUInt16LE(start + 14) === 16;
		}
		if (kind === 'data') pcm = bytes.subarray(start, start + size);
		at = start + size + (size % 2);
	}
	if (!valid || !pcm?.length || pcm.length % 2) throw new Error('Expected nonempty 16 kHz mono s16le WAV');
	return pcm;
}

async function main() {
	const { values } = parseArgs({
		options: {
			engine: { type: 'string' },
			dir: { type: 'string' },
			only: { type: 'string' },
			concurrency: { type: 'string', default: '4' },
			keyterms: { type: 'boolean', default: false },
			'gemini-vad': { type: 'string', default: 'hybrid' },
			'gemini-silence-ms': { type: 'string', default: '400' },
			'gemini-mode': { type: 'string', default: 'VERBATIM' },
		},
		strict: true,
	});
	const engine = values.engine as LabSttEngine;
	if (!['xai', 'elevenlabs', 'gemini-transcribe', 'apple'].includes(engine) || !values.dir)
		throw new Error(
			'Usage: bun scripts/ramble-lab/stt.ts --engine xai|elevenlabs|gemini-transcribe|apple --dir <WAV folder> [--only id1,id2] [--concurrency 4] [--keyterms] [--gemini-vad auto|hybrid] [--gemini-silence-ms 400] [--gemini-mode VERBATIM|SMART]',
		);
	const silenceMs = Number(values['gemini-silence-ms']);
	if (!Number.isInteger(silenceMs) || silenceMs < 100 || silenceMs > 2000)
		throw new Error('Gemini silence must be 100–2000 ms');
	if (!['auto', 'hybrid'].includes(values['gemini-vad'])) throw new Error('Gemini VAD must be auto or hybrid');
	const requestedMode = values['gemini-mode'];
	if (requestedMode !== 'VERBATIM' && requestedMode !== 'SMART')
		throw new Error('Gemini mode must be VERBATIM or SMART');
	const mode: 'VERBATIM' | 'SMART' = requestedMode;
	const concurrency = Number(values.concurrency);
	if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('Concurrency must be a positive integer');
	const keys: Record<string, string> = {};
	if (engine !== 'apple') {
		const content = await Bun.file('.cache/ramble-lab/keys.env').text();
		for (const line of content.split('\n')) {
			const match = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^#]*))/);
			if (match) keys[match[1]] = (match[2] ?? match[3] ?? match[4]).trim();
		}
	}
	const keyName = {
		xai: 'XAI_API_KEY',
		elevenlabs: 'ELEVENLABS_API_KEY',
		'gemini-transcribe': 'GEMINI_API_KEY',
		apple: '',
	}[engine];
	const key = keys[keyName];
	if (engine !== 'apple' && !key) throw new Error(`Missing ${keyName}`);
	const hints = values.keyterms
		? [
				...new Set(
					(await Bun.file('.cache/food-ramble/hints.txt').text())
						.split('\n')
						.map(x =>
							x
								.replace(/[^\p{L} ]/gu, ' ')
								.replace(/\s+/g, ' ')
								.trim(),
						)
						.filter(Boolean),
				),
			].slice(0, 100)
		: [];
	const dir = resolve(values.dir);
	const output = resolve(
		'.cache/ramble-lab/stt',
		engine + (values.keyterms ? '-keyterms' : ''),
		basename(dir),
		...(engine === 'gemini-transcribe' ? [`${values['gemini-vad']}-${silenceMs}-${mode.toLowerCase()}`] : []),
	);
	await mkdir(output, { recursive: true });
	const only = values.only?.split(',');
	const files = (await readdir(dir))
		.filter(x => x.endsWith('.wav') && (!only || only.includes(basename(x, '.wav'))))
		.toSorted();
	if (!files.length) throw new Error('No matching WAV files');
	const pending = [...files];
	const failures: string[] = [];
	async function transcribe(name: string) {
		const id = basename(name, '.wav');
		const target = join(output, `${id}.json`);
		if (await Bun.file(target).exists()) {
			console.log(`skip ${engine}/${id}`);
			return;
		}
		const file = join(dir, name);
		const run: LabSttRun = { engine, clip: file, events: [], audioEndAt: 0, doneAt: 0 };
		const trace: Trace[] = [];
		const lags: number[] = [];
		let start = 0;
		let failure: unknown;
		let session: Session | undefined;
		const sink: Sink = {
			now: () => (start ? performance.now() - start : 0),
			event(kind, text, audioEnd) {
				const at = sink.now();
				run.events.push({ at, kind, text: text.trim() });
				if (kind === 'final' && Number.isFinite(audioEnd)) lags.push(at - audioEnd!);
			},
			trace: message => {
				trace.push({ at: sink.now(), message });
			},
			fail: error => {
				failure = error;
			},
		};
		try {
			const pcm = readWav(Buffer.from(await Bun.file(file).arrayBuffer()));
			const duration = pcm.length / 32;
			if (engine === 'apple') {
				const result = await apple(file, hints, duration);
				Object.assign(run, { events: result.events, audioEndAt: result.audioEndAt, doneAt: result.doneAt });
				for (let i = 0; i < result.rows.length; i++) {
					const row = result.rows[i];
					trace.push({ at: result.events[i].at, message: row });
					if (row.kind === 'final') lags.push(result.events[i].at - row.audioEnd);
				}
			} else {
				session =
					engine === 'xai'
						? await xai(key!, hints, sink)
						: engine === 'elevenlabs'
							? await elevenlabs(key!, hints, sink)
							: await geminiTranscribe(key!, hints, sink, {
									silenceMs,
									mode,
									hybrid: values['gemini-vad'] === 'hybrid',
								});
				start = performance.now();
				for (let at = 0; at < pcm.length; at += 3200) {
					if (failure) throw failure;
					session.audio(pcm.subarray(at, Math.min(at + 3200, pcm.length)));
					run.audioEndAt = sink.now();
					await Bun.sleep(Math.max(0, start + Math.min(at + 3200, pcm.length) / 32 - performance.now()));
				}
				try {
					await within(session.finish(), 5000, 'Finalization exceeded 5 seconds');
				} catch (error) {
					// Scribe has no end-of-stream acknowledgement; use the full drain window after explicit commit.
					if (
						engine !== 'elevenlabs' ||
						!(error instanceof Error) ||
						error.message !== 'Finalization exceeded 5 seconds'
					)
						throw error;
				}
				if (failure) throw failure;
				run.doneAt = sink.now();
			}
		} catch (error) {
			let message = error instanceof Error ? error.message : String(error);
			for (const secret of Object.values(keys))
				if (secret && secret.length > 8) message = message.replaceAll(secret, '[redacted]');
			run.error = message;
			run.doneAt = sink.now();
			failures.push(`${engine}/${id}: ${message}`);
		} finally {
			session?.close();
		}
		if (engine === 'elevenlabs') {
			const finals = run.events.filter(e => e.kind === 'final');
			const timestamps = trace.filter(t => t.message.message_type === 'committed_transcript_with_timestamps');
			for (let i = 0; i < Math.min(finals.length, timestamps.length); i++) {
				const words = timestamps[i].message.words ?? [];
				const end = Math.max(...words.map((w: { end: number }) => w.end));
				if (Number.isFinite(end)) lags.push(finals[i].at - end * 1000);
			}
		}
		if (engine === 'gemini-transcribe' && !lags.length) {
			const finals = run.events.filter(e => e.kind === 'final');
			const ends = trace.filter(t => t.message.voiceActivity?.type === 'ACTIVITY_END');
			for (let i = 0; finals.length === ends.length && i < finals.length; i++) {
				const offset = ends[i].message.voiceActivity.audioOffset;
				if (typeof offset === 'string' && /^\d+(\.\d+)?s$/.test(offset))
					lags.push(finals[i].at - parseFloat(offset) * 1000);
			}
		}
		const drainCompletedAt = run.doneAt;
		if (!run.error) run.doneAt = run.events.findLast(event => event.kind === 'final')?.at ?? run.doneAt;
		await Bun.write(target, JSON.stringify(run, null, 2));
		await Bun.write(
			target.replace(/\.json$/, '.trace'),
			JSON.stringify(
				{
					timing:
						engine === 'gemini-transcribe'
							? 'Wall clock since first frame; final lag uses transcription endOffset or ordered ACTIVITY_END audioOffset (VAD endpoint, not last spoken sample).'
							: engine === 'apple'
								? 'Approximation: audio range end + elapsed offline analysis time; monotonically clamped in arrival order.'
								: 'Wall clock since first frame; mean lag uses provider audio timestamps where available.',
					drainCompletedAt,
					trace,
					finalLagsMs: lags,
				},
				null,
				2,
			),
		);
		const finals = run.events.filter(e => e.kind === 'final');
		console.log(
			JSON.stringify({
				engine,
				id,
				transcript: finals
					.map(event => event.text)
					.join(' ')
					.replace(/\s+/g, ' ')
					.trim(),
				partial: run.events.length - finals.length,
				final: finals.length,
				lastFinalAfterAudioMs: finals.length ? finals.at(-1)!.at - run.audioEndAt : null,
				meanFinalLagMs: lags.length ? lags.reduce((a, b) => a + b, 0) / lags.length : null,
				error: run.error,
			}),
		);
	}
	await Promise.all(
		Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
			for (let name; (name = pending.shift());) await transcribe(name);
		}),
	);
	if (failures.length) process.exitCode = 1;
}
if (import.meta.main) await main();
