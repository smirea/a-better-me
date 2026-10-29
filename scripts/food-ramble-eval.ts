import { parseArgs } from 'node:util';
import { outlineRamble, type RambleItem, type RambleModel, type RambleOutline } from '../server/src/food/ramble';
import { LIVE_SAMPLE_RATE, openLiveRamble, RAMBLE_LIVE_MODEL, TURN_TIMING } from '../server/src/food/ramble-live';
import { DEV, type Case, type Expected } from './food-ramble/cases';
import { HOLDOUT } from './food-ramble/holdout';
import { MEALS, TODAY, USUAL } from './food-ramble/history';

/**
 * Scores the ramble outline call on labelled rambles through the production code path.
 *
 *   GEMINI_API_KEY=… bun scripts/food-ramble-eval.ts [-v] [--set dev|holdout] [--runs n] [--only id,…] \
 *     [--transcripts .cache/food-ramble/Samantha-speech.json [--audio .cache/food-ramble/Samantha]] --with gemini-3.5-flash:minimal,gemini-3.8-flash:low
 *   … --engine live --audio .cache/food-ramble/Samantha [--final [--final-with model:thinking]] [--save live.json] \
 *     [--turns pauseMs:dipAfterMs:maxMs]
 *
 * A case passes only when every item matches in order. Each model runs every case `--runs` times, so flaky cases show
 * as a pass rate below 100%. Latency is per successful call.
 */

const { values } = parseArgs({
	options: {
		v: { type: 'boolean', default: false },
		set: { type: 'string', default: 'dev' },
		runs: { type: 'string', default: '1' },
		only: { type: 'string' },
		with: { type: 'string', default: 'gemini-3.5-flash:minimal' },
		concurrency: { type: 'string', default: '8' },
		transcripts: { type: 'string' },
		audio: { type: 'string' },
		live: { type: 'boolean', default: false },
		engine: { type: 'string', default: 'text' },
		final: { type: 'boolean', default: false },
		'final-with': { type: 'string' },
		save: { type: 'string' },
		turns: { type: 'string' },
	},
});
const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error('GEMINI_API_KEY is not set');
const only = values.only?.split(',');
const cases = (values.set === 'holdout' ? HOLDOUT : values.set === 'all' ? [...DEV, ...HOLDOUT] : DEV).filter(
	c => !only || only.includes(c.id),
);
// Speech-to-text output from scripts/food-ramble-speech.ts replaces each case's typed text.
const spoken: Record<string, string> | null = values.transcripts ? await Bun.file(values.transcripts).json() : null;
if (spoken) for (const c of cases) c.text = spoken[c.id] ?? c.text;
const runs = Number(values.runs);

/** `--audio <dir>` sends `<dir>/<case id>.aiff` along with the transcript, as the phone's final read does. */
async function recording(id: string) {
	if (!values.audio) return undefined;
	const aiff = `${values.audio}/${id}.aiff`;
	const wav = aiff.replace(/\.aiff$/, '.wav');
	if (!(await Bun.file(wav).exists()))
		Bun.spawnSync(['afconvert', '-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', aiff, wav]);
	return { data: Buffer.from(await Bun.file(wav).arrayBuffer()).toString('base64'), mediaType: 'audio/wav' as const };
}
const spec = (text: string): RambleModel => {
	const [model, thinking] = text.split(':');
	return { model: model!, thinking: (thinking as RambleModel['thinking']) ?? null };
};
const turnTimes = values.turns?.split(':').map(Number);
if (turnTimes && (turnTimes.length !== 3 || !turnTimes.every(Number.isFinite)))
	throw new Error('--turns is pauseMs:dipAfterMs:maxMs, three numbers');
const timing = turnTimes ? { pauseMs: turnTimes[0]!, dipAfterMs: turnTimes[1]!, maxMs: turnTimes[2]! } : TURN_TIMING;
const finalModel = values['final-with'] ? spec(values['final-with']) : undefined;
const models: RambleModel[] = values.with.split(',').map(spec);

const UNITS: Record<string, string> = {
	gram: 'g',
	grams: 'g',
	gr: 'g',
	kilogram: 'kg',
	ounce: 'oz',
	ounces: 'oz',
	pound: 'lb',
	lbs: 'lb',
	milliliter: 'ml',
	milliliters: 'ml',
	ml: 'ml',
	liter: 'l',
	cups: 'cup',
	tablespoon: 'tbsp',
	tablespoons: 'tbsp',
	teaspoon: 'tsp',
	teaspoons: 'tsp',
};
const singular = (word: string) =>
	word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
const BASE: Record<string, [string, number]> = {
	g: ['g', 1],
	kg: ['g', 1000],
	oz: ['g', 28.3495],
	lb: ['g', 453.592],
	ml: ['ml', 1],
	l: ['ml', 1000],
};
const unit = (u: string) => {
	const lower = u.trim().toLowerCase();
	return UNITS[lower] ?? singular(lower);
};
const words = (s: string) =>
	s
		.toLowerCase()
		.replace(/(\d)"/g, '$1 inch')
		.split(/[^\p{L}\p{N}%.]+/u)
		.map(w => w.replace(/^\.+|\.+$/g, ''))
		.filter(w => w && !['a', 'an', 'the', 'of', 'with', 'and'].includes(w))
		.map(singular);

function nameMatches(accepted: string[], actual: string): boolean {
	const got = new Set(words(actual));
	return accepted.some(name => {
		const want = words(name);
		return want.every(w => got.has(w)) && got.size <= new Set(want).size + 2;
	});
}

function anyOf<T>(want: T | T[], got: T, same: (a: T, b: T) => boolean = (a, b) => a === b) {
	return (Array.isArray(want) ? want : [want]).some(w => same(w, got));
}

/** The fields of `actual` that differ from `expected`, empty when it matches. */
function diff(expected: Expected, actual: RambleItem, text: string): string[] {
	const misses: string[] = [];
	const kind = expected.kind ?? 'food';
	if (actual.kind !== kind) return [`kind ${actual.kind}`];
	if (expected.name && !nameMatches(expected.name, actual.name)) misses.push(`name "${actual.name}"`);
	// Amount 0 logs one usual serving, so with no unit it is the same entry as amount 1 ("a banana"). Not with a ref:
	// there 0 keeps the logged serving ("my usual pancake" is the usual 2) and 1 is one of the default measure.
	const amount = (a: number, u: string) => (a === 0 && !u && !actual.ref ? 1 : a);
	const [base, scale] = BASE[unit(actual.unit)] ?? [unit(actual.unit), 1];
	const wantUnits = expected.unit === undefined ? [] : Array.isArray(expected.unit) ? expected.unit : [expected.unit];
	const sameQuantity = wantUnits.some(u => {
		const [wantBase, wantScale] = BASE[unit(u)] ?? [unit(u), 1];
		const wants = Array.isArray(expected.amount) ? expected.amount : [expected.amount ?? actual.amount];
		return (
			wantBase === base &&
			wants.some(w => Math.abs(amount(w, u) * wantScale - amount(actual.amount, actual.unit) * scale) < 0.01)
		);
	});
	if (!sameQuantity) {
		if (
			expected.amount !== undefined &&
			!anyOf(expected.amount, actual.amount, (a, b) => amount(a, actual.unit) === amount(b, actual.unit))
		)
			misses.push(`amount ${actual.amount}`);
		if (expected.unit !== undefined && !anyOf(expected.unit, actual.unit, (a, b) => unit(a) === unit(b)))
			misses.push(`unit "${actual.unit}"`);
	}
	if (!anyOf(expected.ref ?? null, actual.ref)) misses.push(`ref ${actual.ref}`);
	if ((expected.copy ?? null) !== actual.copy) misses.push(`copy ${actual.copy}`);
	if ((expected.except ?? []).toSorted().join() !== actual.except.toSorted().join())
		misses.push(`except [${actual.except}]`);
	if (expected.meal !== undefined && !anyOf(expected.meal, actual.meal)) misses.push(`meal "${actual.meal}"`);
	if ((expected.time ?? '') !== actual.time) misses.push(`time "${actual.time}"`);
	// A labelled day was said and must come back. Otherwise the phone's open day applies, unless "today" was said.
	const today = actual.day === 0 && /\btoday\b/i.test(text);
	if (expected.day === undefined ? actual.day !== null && !today : expected.day !== actual.day)
		misses.push(`day ${actual.day}`);
	if ((expected.options ?? false) !== actual.options) misses.push(`options ${actual.options}`);
	return misses;
}

type Outcome = { id: string; use: Case['use']; pass: boolean; misses: string[]; ms: number | null; error?: string };

function check(c: Case, outline: RambleOutline): string[] {
	const misses: string[] = [];
	if (outline.items.length !== c.items.length) misses.push(`${outline.items.length} items, want ${c.items.length}`);
	// Order does not change what is logged: each expected item takes the first unclaimed match, else is compared with
	// the item at its own position.
	const claimed = new Set<number>();
	c.items.forEach((expected, i) => {
		const match = outline.items.findIndex((item, j) => !claimed.has(j) && diff(expected, item, c.text).length === 0);
		if (match >= 0) return claimed.add(match);
		const actual = outline.items[i];
		if (actual) for (const miss of diff(expected, actual, c.text)) misses.push(`#${i + 1} ${miss}`);
		else misses.push(`#${i + 1} missing`);
	});
	if (values.v && misses.length) misses.push(`got ${JSON.stringify(outline.items)}`);
	return misses;
}

const retryable = (error: unknown) => /\b(409|429|500|502|503|504|1011)\b|unreachable|ABORTED/.test(String(error));

async function score(model: RambleModel, c: Case): Promise<Outcome> {
	const started = performance.now();
	for (let attempt = 0; ; attempt++) {
		try {
			const outline = await outlineRamble(
				{
					transcript: c.text,
					today: TODAY,
					time: c.time ?? '20:30',
					meals: MEALS,
					usual: USUAL,
					shown: c.shown,
					audio: await recording(c.id),
				},
				key!,
				model,
			);
			const misses = check(c, outline);
			return { id: c.id, use: c.use, pass: misses.length === 0, misses, ms: performance.now() - started };
		} catch (error) {
			if (attempt < 3 && retryable(error)) {
				await Bun.sleep(2000 * (attempt + 1));
				continue;
			}
			return { id: c.id, use: c.use, pass: false, misses: [], ms: null, error: String(error).slice(0, 300) };
		}
	}
}

/**
 * `--engine live` streams `<--audio>/<case id>.wav` to a Gemini Live session in real time, 100 ms a frame, and
 * scores what its tool calls built. `--final` also scores the final read on the same session: Live's transcript plus
 * the recording through `outlineRamble` with the final model. Latency is from the end of the audio.
 */
type LiveScore = {
	live: Outcome;
	final?: Outcome;
	transcript: string;
	/** When the first row appeared, and how long the audio ran, in ms from its start. */
	first: number | null;
	audioMs: number;
};

async function scoreLive(model: string, c: Case): Promise<LiveScore> {
	const wav = await recording(c.id);
	if (!wav) throw new Error('--engine live needs --audio');
	const pcm = new Uint8Array(Buffer.from(wav.data, 'base64')).subarray(44);
	const frame = (LIVE_SAMPLE_RATE / 10) * 2;
	const request = { today: TODAY, time: c.time ?? '20:30', meals: MEALS, usual: USUAL, shown: c.shown };
	const audioMs = (pcm.length / 2 / LIVE_SAMPLE_RATE) * 1000;
	for (let attempt = 0; ; attempt++) {
		try {
			let first: number | null = null;
			let start = performance.now();
			const outline = (o: RambleOutline) => {
				if (first === null && o.items.length) first = performance.now() - start;
			};
			const session = await openLiveRamble(request, key!, { transcript() {}, outline, error() {} }, model, timing);
			start = performance.now();
			for (let at = 0; at < pcm.length; at += frame) {
				session.audio(pcm.subarray(at, at + frame));
				const due = start + ((at + frame) / 2 / LIVE_SAMPLE_RATE) * 1000;
				await Bun.sleep(Math.max(0, due - performance.now()));
			}
			const ended = performance.now();
			const result = await session.finish();
			const ms = performance.now() - ended;
			session.close();
			const misses = check(c, result.outline);
			const live = { id: c.id, use: c.use, pass: misses.length === 0, misses, ms };
			if (!values.final) return { live, transcript: result.transcript, first, audioMs };
			let final: Outcome;
			try {
				const outline = await outlineRamble(
					{ ...request, transcript: result.transcript, audio: wav },
					key!,
					finalModel,
				);
				const finalMisses = check(c, outline);
				final = { id: c.id, use: c.use, pass: !finalMisses.length, misses: finalMisses, ms: performance.now() - ended };
			} catch (error) {
				final = { id: c.id, use: c.use, pass: false, misses: [], ms: null, error: String(error).slice(0, 300) };
			}
			return { live, final, transcript: result.transcript, first, audioMs };
		} catch (error) {
			if (attempt < 3 && retryable(error)) {
				await Bun.sleep(2000 * (attempt + 1));
				continue;
			}
			const failed = { id: c.id, use: c.use, pass: false, misses: [], ms: null, error: String(error).slice(0, 300) };
			return { live: failed, final: values.final ? failed : undefined, transcript: '', first: null, audioMs };
		}
	}
}

/** How many rambles of 5 s or more showed a row while still being spoken, and how far into the audio the first came. */
function early(results: LiveScore[]) {
	const long = results.filter(r => r.audioMs >= 5_000);
	const during = long.filter(r => r.first !== null && r.first < r.audioMs);
	const share = during.map(r => r.first! / r.audioMs).toSorted((a, b) => a - b);
	const first = share.length ? pct(percentile(share, 0.5), 1) : 'n/a';
	return `row while talking ${pct(during.length, long.length)} of ${long.length} long  first at ${first} of the audio`;
}

/** Word error rate of `heard` against the typed `said`, by word edit distance. */
function wer(said: string, heard: string) {
	const norm = (text: string) =>
		text
			.toLowerCase()
			.replace(/[^\p{L}\p{N}%.' ]+/gu, ' ')
			.split(/\s+/)
			.filter(Boolean);
	const a = norm(said);
	const b = norm(heard);
	let row = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const next = [i];
		for (let j = 1; j <= b.length; j++)
			next[j] = Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
		row = next;
	}
	return { errors: row[b.length]!, words: a.length };
}

async function pool<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
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

const percentile = (sorted: number[], p: number) =>
	sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
const pct = (n: number, d: number) => `${((100 * n) / Math.max(1, d)).toFixed(0)}%`;

/**
 * `--live` replays each ramble of 12 words or more as the phone would read it, a prefix every 4 words, and counts
 * churn: a row already on screen that changes food or vanishes although the new words hold no correction.
 */
const CORRECTION =
	/\b(actually|actual|wait|no|not|instead|replace|remove|scratch|sorry|mean|make (it|that)|without|but|skip|change|go with|one|should be|options|wrong)\b/i;
async function live(model: RambleModel) {
	const replays = cases.filter(c => c.text.split(/\s+/).length >= 12);
	const results = await pool(replays, Number(values.concurrency), async c => {
		const words = c.text.split(/\s+/);
		let shown: RambleItem[] = [];
		let churn = 0;
		let reads = 0;
		for (let end = 4; end < words.length + 4; end += 4) {
			const prefix = words.slice(0, Math.min(end, words.length)).join(' ');
			const added = words.slice(Math.max(0, end - 4), end).join(' ');
			const outline = await outlineRamble(
				{ transcript: prefix, today: TODAY, time: c.time ?? '20:30', meals: MEALS, usual: USUAL, shown: c.shown },
				key!,
				model,
			);
			reads++;
			if (!CORRECTION.test(added))
				shown.forEach((before, i) => {
					const after = outline.items[i];
					const same =
						after && after.kind === before.kind && (after.copy ?? after.name) === (before.copy ?? before.name);
					if (!same && !outline.items.some(item => (item.copy ?? item.name) === (before.copy ?? before.name))) {
						churn++;
						if (values.v)
							console.log(`  ~ ${c.id} @${end}: "${before.copy ?? before.name}" → "${after?.copy ?? after?.name}"`);
					}
				});
			shown = outline.items;
		}
		return { churn, reads };
	});
	const churn = results.reduce((sum, r) => sum + r.churn, 0);
	const reads = results.reduce((sum, r) => sum + r.reads, 0);
	console.log(
		`${model.model}:${model.thinking}  live replays ${replays.length}, reads ${reads}, churned rows ${churn} (${pct(churn, reads)} of reads), rambles with churn ${results.filter(r => r.churn).length}`,
	);
}
if (values.live) {
	for (const model of models) await live(model);
	process.exit(0);
}

const summary: string[] = [];
function report(name: string, outcomes: Outcome[], extra = '') {
	const latencies = outcomes.flatMap(o => (o.ms === null ? [] : [o.ms])).toSorted((a, b) => a - b);
	const uses = [...new Set(cases.map(c => c.use))];
	const byUse = uses.map(use => {
		const mine = outcomes.filter(o => o.use === use);
		return `${use} ${pct(mine.filter(o => o.pass).length, mine.length)}`;
	});
	const passed = outcomes.filter(o => o.pass).length;
	const errors = outcomes.filter(o => o.error).length;
	const line = `${name.padEnd(34)} pass ${pct(passed, outcomes.length).padStart(4)} (${passed}/${outcomes.length})  errors ${errors}  p50 ${percentile(latencies, 0.5).toFixed(0)}ms  p90 ${percentile(latencies, 0.9).toFixed(0)}ms  | ${byUse.join('  ')}${extra}`;
	summary.push(line);
	console.log(`\n${line}`);
	const failures = new Map<string, string[]>();
	for (const o of outcomes.filter(outcome => !outcome.pass))
		failures.set(o.id, [...(failures.get(o.id) ?? []), o.error ?? o.misses.join('; ')]);
	for (const [id, misses] of failures) console.log(`  ✗ ${id} (${misses.length}/${runs}): ${misses[0]}`);
}

const jobs = Array.from({ length: runs }, () => cases).flat();
if (values.engine === 'live') {
	const said = new Map(cases.map(c => [c.id, c.text]));
	for (const model of values.with === 'gemini-3.5-flash:minimal' ? [RAMBLE_LIVE_MODEL] : values.with.split(',')) {
		const results = await pool(jobs, Number(values.concurrency), c => scoreLive(model, c));
		const typed = new Map([...DEV, ...HOLDOUT].map(c => [c.id, c.text]));
		const counts = results.map(r => wer(typed.get(r.live.id) ?? said.get(r.live.id)!, r.transcript));
		const errors = counts.reduce((sum, w) => sum + w.errors, 0);
		const total = counts.reduce((sum, w) => sum + w.words, 0);
		report(
			model,
			results.map(r => r.live),
			`  | transcript WER ${pct(errors, total)}  | ${early(results)}`,
		);
		if (values.final)
			report(
				`${model} + final`,
				results.map(r => r.final!),
			);
		if (values.v) for (const r of results) console.log(`  ${r.live.id}: ${r.transcript}`);
		// `--save <file>` keeps Live's transcripts, so `--transcripts <file> --audio <dir>` scores the final read later.
		if (values.save)
			await Bun.write(
				values.save,
				`${JSON.stringify(Object.fromEntries(results.map(r => [r.live.id, r.transcript])), null, '\t')}\n`,
			);
	}
} else
	for (const model of models)
		report(
			`${model.model}${model.thinking ? `:${model.thinking}` : ''}`,
			await pool(jobs, Number(values.concurrency), c => score(model, c)),
		);
if (summary.length > 1) console.log(`\n${summary.join('\n')}`);
