import { parseArgs } from 'node:util';
import type { RambleOutline } from '../../server/src/food/ramble';
import { DEV } from '../food-ramble/cases';
import { MEALS, TODAY, USUAL } from '../food-ramble/history';
import { HOLDOUT } from '../food-ramble/holdout';
import { check, nameMatches } from '../food-ramble/score';
import type { RambleModel } from '../../server/src/food/ramble';
import { parse, parserSpec, type Parsed } from './parse';
import { transcriptAt, type LabCase, type SttRun } from './types';

/**
 * Replays transcript timelines through text parsers on a virtual clock, with real parser calls, as the live
 * pipeline would run them, through the server's `outlineRamble`. No final read: what the last read returns is what
 * gets logged.
 *
 *   bun scripts/ramble-lab/replay.ts --stt <dir of SttRun json | typed> --parsers gemini-3.5-flash:minimal,… \
 *     [--trigger final|partial] [--debounce 250] [--set lab|dev|all] [--only ids] [--wps 2.6] [--save out.json] [-v]
 */

const { values } = parseArgs({
	options: {
		stt: { type: 'string', default: 'typed' },
		parsers: { type: 'string', default: 'gemini-3.5-flash:minimal' },
		trigger: { type: 'string', default: 'partial' },
		debounce: { type: 'string', default: '250' },
		inflight: { type: 'string', default: '1' },
		'stop-now': { type: 'boolean', default: false },
		set: { type: 'string', default: 'lab' },
		only: { type: 'string' },
		wps: { type: 'string', default: '2.6' },
		concurrency: { type: 'string', default: '16' },
		save: { type: 'string' },
		v: { type: 'boolean', default: false },
	},
});

const lab: LabCase[] = await import('./corpus').then(
	m => m.LAB as LabCase[],
	() => [],
);
const asLab = (c: (typeof DEV)[number]): LabCase => ({ ...c, persona: 'precise', scenario: c.use });
const pool =
	values.set === 'dev'
		? DEV.map(asLab)
		: values.set === 'all'
			? [...lab, ...DEV.map(asLab), ...HOLDOUT.map(asLab)]
			: lab;
const only = values.only?.split(',');
const cases = pool.filter(c => !only || only.includes(c.id));
const debounce = Number(values.debounce);
const inflightLimit = Number(values.inflight);

/** The labelled text revealed a word at a time at `--wps`, committed at each comma or period, as a perfect transcriber would. */
function typed(c: LabCase): SttRun {
	const words = c.text.split(/\s+/).filter(Boolean);
	const msPerWord = 1000 / Number(values.wps);
	const events: SttRun['events'] = [];
	let segment: string[] = [];
	words.forEach((word, i) => {
		segment.push(word);
		const at = Math.round((i + 1) * msPerWord);
		if (/[,.?!]$/.test(word) || i === words.length - 1) {
			events.push({ at: at + 150, kind: 'final', text: segment.join(' ') });
			segment = [];
		} else events.push({ at, kind: 'partial', text: segment.join(' ') });
	});
	const end = Math.round(words.length * msPerWord);
	return { engine: 'apple', clip: `typed/${c.id}`, events, audioEndAt: end, doneAt: end + 150 };
}

async function runFor(c: LabCase): Promise<SttRun | null> {
	if (values.stt === 'typed') return typed(c);
	const file = Bun.file(`${values.stt}/${c.id}.json`);
	return (await file.exists()) ? ((await file.json()) as SttRun) : null;
}

type Read = { issuedAt: number; at: number; text: string; parsed: Parsed };
type Replay = {
	case: LabCase;
	run: SttRun;
	reads: Read[];
	final: RambleOutline;
	misses: string[];
	error?: string;
};

const retryable = (error: unknown) =>
	/\b(429|500|502|503|504)\b|fetch failed|ECONNRESET|timed out/i.test(String(error));

let rateLimited = 0;
async function read(spec: RambleModel, c: LabCase, text: string): Promise<Parsed> {
	const request = { today: TODAY, time: c.time ?? '20:30', meals: MEALS, usual: USUAL, shown: c.shown };
	for (let attempt = 0; ; attempt++) {
		try {
			return await parse(spec, request, text, AbortSignal.timeout(20_000));
		} catch (error) {
			if (attempt < 6 && retryable(error)) {
				rateLimited++;
				await Bun.sleep(1000 * 2 ** attempt);
				continue;
			}
			throw error;
		}
	}
}

/**
 * Plays the timeline in real time with real timers, as the server would run it: a read starts `debounce` after the
 * transcript changes, at most `inflight` at once, and the answer to the newest text wins. After the audio ends the
 * last words are read at once (`--stop-now`), without waiting for a read in flight.
 */
async function replay(spec: RambleModel, c: LabCase, run: SttRun): Promise<Replay> {
	const textAt = (at: number) => {
		const { committed, partial } = transcriptAt(run, at);
		return values.trigger === 'partial' ? `${committed} ${partial}`.trim() : committed;
	};
	const finalText = textAt(Infinity);
	const reads: Read[] = [];
	const start = performance.now();
	const now = () => performance.now() - start;
	let latest = '';
	let issued = '';
	let inflight = 0;
	let sequence = 0;
	let applied = 0;
	let failure: unknown;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let settle!: () => void;
	const settled = new Promise<void>(resolve => (settle = resolve));
	const ended = () => now() >= run.audioEndAt;
	const issue = () => {
		if (!latest || latest === issued || inflight >= inflightLimit) return;
		const text = latest;
		const mine = ++sequence;
		const issuedAt = now();
		issued = text;
		inflight++;
		read(spec, c, text).then(
			parsed => {
				inflight--;
				if (mine > applied) {
					applied = mine;
					reads.push({ issuedAt, at: now(), text, parsed });
				}
				if (applied === sequence && issued === finalText && ended()) settle();
				else issue();
			},
			error => {
				inflight--;
				failure = error;
				settle();
			},
		);
	};
	const changed = (text: string) => {
		if (text === latest) return;
		latest = text;
		clearTimeout(timer);
		const wait = values['stop-now'] && ended() ? 0 : debounce;
		timer = setTimeout(issue, wait);
	};
	const times = [...new Set(run.events.filter(e => values.trigger === 'partial' || e.kind === 'final').map(e => e.at))];
	for (const at of times) setTimeout(() => changed(textAt(at)), at);
	setTimeout(() => {
		if (!finalText) settle();
	}, run.doneAt + 10);
	await Promise.race([settled, Bun.sleep(run.doneAt + 30_000)]);
	clearTimeout(timer);
	const final = reads.at(-1)?.parsed.outline ?? { items: [] };
	if (failure) return { case: c, run, reads, final, misses: ['error'], error: String(failure).slice(0, 200) };
	return { case: c, run, reads, final, misses: check(c, final) };
}

async function pooled<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
	const results: R[] = Array.from({ length: items.length });
	let next = 0;
	await Promise.all(
		Array.from({ length: size }, async () => {
			while (next < items.length) {
				const i = next++;
				results[i] = await work(items[i]!);
			}
		}),
	);
	return results;
}

const pct = (n: number, d: number) => `${((100 * n) / Math.max(1, d)).toFixed(0)}%`;
const quantile = (xs: number[], q: number) => {
	const sorted = xs.toSorted((a, b) => a - b);
	return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]! : NaN;
};
const s = (ms: number) => (Number.isFinite(ms) ? `${(ms / 1000).toFixed(2)}s` : 'n/a');

/** Rows that showed while talking but match no labelled item by name, so they flashed up and had to go. */
function phantoms(r: Replay) {
	const seen = new Set<string>();
	for (const { parsed } of r.reads)
		for (const item of parsed.outline.items) {
			const name = item.copy ?? item.name;
			if (!r.case.items.some(e => (e.copy ? e.copy === item.copy : e.name && nameMatches(e.name, item.name))))
				seen.add(name);
		}
	return seen.size;
}

const report: Record<string, unknown>[] = [];
const runs = new Map<string, SttRun>();
for (const c of cases) {
	const run = await runFor(c);
	if (run && !run.error) runs.set(c.id, run);
}
const scored = cases.filter(c => runs.has(c.id));
console.log(`${scored.length} of ${cases.length} cases have a ${values.stt} timeline`);

for (const text of values.parsers.split(',')) {
	const spec = parserSpec(text);
	const results = await pooled(scored, Number(values.concurrency), c => replay(spec, c, runs.get(c.id)!));
	const passed = results.filter(r => !r.misses.length);
	const settle = results.map(r => Math.max(0, (r.reads.at(-1)?.at ?? r.run.doneAt) - r.run.audioEndAt));
	const firstRow = results
		.filter(r => r.run.audioEndAt >= 4000)
		.map(r => (r.reads.find(read => read.parsed.outline.items.length)?.at ?? Infinity) / r.run.audioEndAt);
	const latency = results.flatMap(r => r.reads.map(read => read.parsed.ms));
	const phantom = results.reduce((sum, r) => sum + phantoms(r), 0);
	const byPersona = Object.entries(Object.groupBy(results, r => r.case.persona))
		.map(([persona, rs]) => `${persona} ${pct(rs!.filter(r => !r.misses.length).length, rs!.length)}`)
		.join('  ');
	console.log(
		`\n${text.padEnd(40)} pass ${pct(passed.length, results.length)} (${passed.length}/${results.length})  errors ${results.filter(r => r.error).length}  settle p50 ${s(quantile(settle, 0.5))} p90 ${s(quantile(settle, 0.9))}  read p50 ${s(quantile(latency, 0.5))}  first row at ${pct(quantile(firstRow, 0.5) * 100, 100)} of audio  phantoms ${phantom}  reads ${latency.length}  retried ${rateLimited}\n  ${byPersona}`,
	);
	for (const r of results.filter(r => r.misses.length))
		console.log(
			`  ✗ ${r.case.id}: ${r.error ?? r.misses.join('; ')}${values.v ? `\n     heard: ${r.reads.at(-1)?.text}\n     got: ${JSON.stringify(r.final.items.map(i => `${i.amount} ${i.unit} ${i.copy ?? i.name} ${i.meal} d${i.day ?? ''} ${i.time}${i.options ? ' opts' : ''}`))}` : ''}`,
		);
	report.push({
		parser: text,
		stt: values.stt,
		trigger: values.trigger,
		debounce,
		results: results.map(r => ({
			id: r.case.id,
			persona: r.case.persona,
			pass: !r.misses.length,
			misses: r.misses,
			error: r.error,
			settleMs: Math.max(0, (r.reads.at(-1)?.at ?? r.run.doneAt) - r.run.audioEndAt),
			audioMs: r.run.audioEndAt,
			reads: r.reads.map(read => ({
				issuedAt: read.issuedAt,
				at: read.at,
				text: read.text,
				items: read.parsed.outline.items,
			})),
		})),
	});
}
if (values.save) await Bun.write(values.save, JSON.stringify(report));
