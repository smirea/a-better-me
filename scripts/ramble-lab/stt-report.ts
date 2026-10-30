import { readdirSync } from 'node:fs';
import { LAB } from './corpus';
import { transcriptAt, type SttRun } from './types';

/**
 * Word error rate and timing of every transcriber run under .cache/ramble-lab/stt/<engine>/<audio set>/.
 *
 *   bun scripts/ramble-lab/stt-report.ts [audio set filter]
 *
 * Numbers are compared as numbers: "two hundred" and "200" are one token, so digit style is not an error.
 */

const root = '.cache/ramble-lab/stt';
const filter = process.argv[2];
const said = new Map(LAB.map(c => [c.id, c.text]));

const SMALL: Record<string, number> = {
	zero: 0,
	one: 1,
	two: 2,
	three: 3,
	four: 4,
	five: 5,
	six: 6,
	seven: 7,
	eight: 8,
	nine: 9,
	ten: 10,
	eleven: 11,
	twelve: 12,
	thirteen: 13,
	fourteen: 14,
	fifteen: 15,
	sixteen: 16,
	seventeen: 17,
	eighteen: 18,
	nineteen: 19,
	twenty: 20,
	thirty: 30,
	forty: 40,
	fifty: 50,
	sixty: 60,
	seventy: 70,
	eighty: 80,
	ninety: 90,
};

function tokens(text: string): string[] {
	const raw = text
		.toLowerCase()
		.replace(/(\d),(\d)/g, '$1$2')
		.replace(/[^\p{L}\p{N}.' ]+/gu, ' ')
		.split(/\s+/)
		.map(w => w.replace(/^[.']+|[.']+$/g, ''))
		.filter(w => w && !['um', 'uh', 'uhm', 'hmm', 'er', 'ah'].includes(w));
	const out: string[] = [];
	let number: number | null = null;
	const flush = () => {
		if (number !== null) out.push(String(number));
		number = null;
	};
	for (const word of raw) {
		if (word in SMALL) number = (number ?? 0) + SMALL[word]!;
		else if (word === 'hundred' && number !== null) number *= 100;
		else if (word === 'thousand' && number !== null) number *= 1000;
		else if (word === 'and' && number !== null && number >= 100) continue;
		else {
			flush();
			out.push(word);
		}
	}
	flush();
	return out;
}

function errors(a: string[], b: string[]) {
	let row = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const next = [i];
		for (let j = 1; j <= b.length; j++)
			next[j] = Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
		row = next;
	}
	return row[b.length]!;
}

const q = (xs: number[], p: number) =>
	xs.toSorted((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))] ?? NaN;

function* folders(dir: string): Generator<string> {
	const entries = readdirSync(dir, { withFileTypes: true });
	if (entries.some(e => e.isFile() && e.name.endsWith('.json'))) yield dir;
	for (const e of entries) if (e.isDirectory() && e.name !== 'apple-tool') yield* folders(`${dir}/${e.name}`);
}

for (const dir of folders(root)) {
	{
		if (filter && !dir.includes(filter)) continue;
		const [engine, ...rest] = dir.slice(root.length + 1).split('/');
		const set = rest.join('/');
		const runs = readdirSync(dir)
			.filter(f => f.endsWith('.json') && said.has(f.replace('.json', '')))
			.map(f => require(`${process.cwd()}/${dir}/${f}`) as SttRun);
		if (!runs.length) continue;
		let wrong = 0;
		let total = 0;
		const finalize: number[] = [];
		const cadence: number[] = [];
		let failed = 0;
		for (const run of runs) {
			if (run.error) {
				failed++;
				continue;
			}
			const id = run.clip
				.split('/')
				.at(-1)!
				.replace(/\.(wav|json)$/, '');
			const truth = tokens(said.get(id) ?? '');
			const heard = transcriptAt(run, Infinity).committed;
			wrong += errors(truth, tokens(heard));
			total += truth.length;
			finalize.push(run.doneAt - run.audioEndAt);
			const partials = run.events.filter(e => e.kind === 'partial').map(e => e.at);
			for (let i = 1; i < partials.length; i++) cadence.push(partials[i]! - partials[i - 1]!);
		}
		console.log(
			`${engine.padEnd(28)} ${set.padEnd(24)} n=${String(runs.length).padStart(3)} failed=${failed}  WER ${((100 * wrong) / Math.max(1, total)).toFixed(1)}%  last words committed after stop p50 ${q(finalize, 0.5).toFixed(0)}ms p90 ${q(finalize, 0.9).toFixed(0)}ms  partial every ${q(cadence, 0.5).toFixed(0)}ms`,
		);
	}
}
