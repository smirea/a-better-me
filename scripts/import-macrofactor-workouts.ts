/**
 * Rebuilds the owner's MacroFactor Workouts history from a Granular Export through the agent API:
 *
 *     OWNER_TOKEN=<token> bun scripts/import-macrofactor-workouts.ts --server <url> <granular.xlsx...> [--dry-run]
 *
 * The export's Workouts sheet is empty; its per-exercise sheets ("Exercises - Total Sets", "Total Reps", "Heaviest
 * Weight", "Total Volume", "Best Set Volume", "Best Set Reps", and the duration pair) hold one row per training day. Each
 * day becomes one finished session whose sets reproduce those totals. Rules and what is left out are in
 * docs/decisions/workouts.md, "MacroFactor history import".
 */
import { parseArgs } from 'node:util';
import { client, every, format, pool, readExport, stableId, toDay, type Counts } from './import-macrofactor';
import type { Cell, Sheet } from './xlsx';

const KG_PER = { lb: 0.45359237, kg: 1 } as const;
/** Weights the split invents land on a plate-friendly step of the export's unit. */
const STEP = { lb: 0.5, kg: 0.25 } as const;
/** MacroFactor's export has no time of day; noon in the owner's Central time, as the earlier sessions were logged. */
const START_UTC = 'T17:00:00.000Z';
const SETUP_SECONDS_PER_EXERCISE = 120;
const SECONDS_PER_SET = 45 + 90;

type Unit = keyof typeof KG_PER;
type Metric = 'sets' | 'reps' | 'heaviest' | 'volume' | 'bestVolume' | 'bestReps' | 'duration' | 'bestDuration';
const SHEETS: Record<string, Metric> = {
	'Exercises - Total Sets': 'sets',
	'Exercises - Total Reps': 'reps',
	'Exercises - Heaviest Weight': 'heaviest',
	'Exercises - Total Volume': 'volume',
	'Exercises - Best Set Volume': 'bestVolume',
	'Exercises - Best Set Reps': 'bestReps',
	'Exercises - Total Duration': 'duration',
	'Exercises - Best Set Duration': 'bestDuration',
};

/** One exercise on one day, as the export's sheets total it. Weights in `unit`, volume per the app's per-side rule. */
export type DayTotals = Partial<Record<Metric, number>> & { unit: Unit };
/** One set as logged: weight in the export's unit. */
export type RebuiltSet = { weight?: number; reps?: number; durationSeconds?: number };

const splitUnit = (header: string) => {
	const match = /^(.*?) \(([^()]*)\)$/.exec(header);
	return match ? { name: match[1]!.trim(), unit: match[2]! } : { name: header.trim(), unit: '' };
};

/** `day -> exercise name -> totals`, merged over every file given. */
export function parseWorkoutDays(workbooks: Map<string, Sheet>[]): Map<string, Map<string, DayTotals>> {
	const days = new Map<string, Map<string, DayTotals>>();
	for (const book of workbooks) {
		for (const [sheetName, metric] of Object.entries(SHEETS)) {
			const sheet = book.get(sheetName);
			if (!sheet?.length) continue;
			const headers = sheet[0]!.map(cell => splitUnit(String(cell ?? '')));
			for (const row of sheet.slice(1)) {
				if (row[0] === null || row[0] === undefined) continue;
				const day = toDay(row[0] as Cell);
				const exercises = days.get(day) ?? new Map<string, DayTotals>();
				headers.forEach(({ name, unit }, index) => {
					const value = row[index];
					if (!index || typeof value !== 'number') return;
					const totals = exercises.get(name) ?? { unit: 'lb' };
					if (unit === 'lb' || unit === 'kg') totals.unit = unit;
					totals[metric] = value;
					exercises.set(name, totals);
				});
				if (exercises.size) days.set(day, exercises);
			}
		}
	}
	return days;
}

/** Splits `total` into `count` whole parts as evenly as possible, larger parts first. */
function spread(total: number, count: number): number[] {
	const base = Math.floor(total / count);
	return Array.from({ length: count }, (_, index) => base + (index < total - base * count ? 1 : 0));
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/**
 * Sets whose count, reps, top weight, best set, and volume are the day's totals. The export keeps only totals, so how
 * the reps and lighter weights split across sets is estimated: the heaviest set comes first, the best set by volume
 * and the best set by reps are kept when they are a different set, and the rest share the remaining reps evenly at the
 * weight that leaves the remaining volume. `perSide` is the app's rule that doubles volume (`WorkoutMetrics`).
 */
export function rebuildSets(totals: DayTotals, perSide: boolean): RebuiltSet[] {
	const count = Math.max(1, Math.round(totals.sets ?? 1));
	if (totals.reps === undefined) {
		if (totals.duration === undefined) return Array.from({ length: count }, () => ({}));
		const best = Math.min(totals.bestDuration ?? totals.duration, totals.duration);
		const rest = count > 1 ? spread(Math.round(totals.duration - best), count - 1) : [];
		return [best, ...rest].map(durationSeconds => ({ durationSeconds }));
	}
	const reps = Math.round(totals.reps);
	const bestReps = Math.min(Math.round(totals.bestReps ?? reps), reps);
	const heaviest = totals.heaviest;
	if (!heaviest) {
		const rest = count > 1 ? spread(reps - bestReps, count - 1) : [];
		return [bestReps, ...rest].map(value => ({ reps: value }));
	}
	const factor = perSide ? 2 : 1;
	const volume = (totals.volume ?? heaviest * reps * factor) / factor;
	const bestVolume = (totals.bestVolume ?? heaviest * bestReps * factor) / factor;
	const step = STEP[totals.unit];

	const fixed: Required<Pick<RebuiltSet, 'weight' | 'reps'>>[] = [];
	const topReps = bestVolume / heaviest;
	if (Math.abs(topReps - Math.round(topReps)) < 0.05 && Math.round(topReps) >= 1 && Math.round(topReps) <= bestReps) {
		fixed.push({ weight: heaviest, reps: Math.round(topReps) });
	} else {
		const bestWeight = roundTo(bestVolume / bestReps, step);
		// The heaviest set's reps are what the volume leaves when the other sets sit at the best set's weight.
		const solved =
			count > 2 && heaviest - bestWeight >= step
				? Math.round((volume - bestVolume - bestWeight * (reps - bestReps)) / (heaviest - bestWeight))
				: Math.floor(bestVolume / heaviest);
		const ceiling = Math.min(bestReps, Math.floor(bestVolume / heaviest), reps - bestReps - (count - 2));
		const floor = Math.max(1, reps - bestReps * (count - 1));
		fixed.push({ weight: heaviest, reps: Math.max(floor, Math.min(ceiling, solved)) });
		if (count > 1) fixed.push({ weight: bestWeight, reps: bestReps });
	}
	if (count > fixed.length && !fixed.some(set => set.reps === bestReps)) {
		fixed.push({ weight: roundTo(Math.min(heaviest, bestVolume / bestReps), step), reps: bestReps });
	}

	const left = count - fixed.length;
	if (left <= 0) {
		const sets = fixed.slice(0, count);
		const top = sets[0]!;
		top.reps = Math.max(1, Math.min(bestReps, top.reps + reps - sets.reduce((sum, set) => sum + set.reps, 0)));
		return sets;
	}
	const leftReps = Math.max(left, reps - fixed.reduce((sum, set) => sum + set.reps, 0));
	const leftVolume = volume - fixed.reduce((sum, set) => sum + set.weight * set.reps, 0);
	const split = spread(leftReps, left).map(value => Math.min(value, bestReps));
	const cap = Math.min(heaviest, Math.floor(bestVolume / split[0]! / step) * step);
	const weight = Math.min(cap, Math.max(step, roundTo(leftVolume / leftReps, step)));
	return [...fixed, ...split.map(value => ({ weight, reps: value }))];
}

/** How far the rebuilt sets land from the day's totals: 0 everywhere but volume, which absorbs the rounding. */
export function drift(totals: DayTotals, sets: RebuiltSet[], perSide: boolean) {
	const factor = perSide ? 2 : 1;
	const weighted = sets.filter(set => set.weight !== undefined && set.reps !== undefined);
	return {
		sets: sets.length - Math.round(totals.sets ?? sets.length),
		reps: totals.reps === undefined ? 0 : sets.reduce((sum, set) => sum + (set.reps ?? 0), 0) - Math.round(totals.reps),
		heaviest: totals.heaviest ? Math.max(...weighted.map(set => set.weight!)) - totals.heaviest : 0,
		volumePercent:
			totals.heaviest && totals.volume
				? (100 * (weighted.reduce((sum, set) => sum + set.weight! * set.reps!, 0) * factor - totals.volume)) /
					totals.volume
				: 0,
	};
}

type Exercise = { id: string; name: string; alternativeNames: string[]; metrics: string[]; custom: boolean };

const words = (name: string) =>
	name.toLowerCase().replace(/[()]/g, ' ').split(/\s+/).filter(Boolean).toSorted().join(' ');

/**
 * `ExerciseResolver`'s rules: the name, then an alternative name only one exercise carries, then the same words in
 * another order when only one exercise has them, so MacroFactor's older "Chest-Supported Elbows-Out Dumbbell Row"
 * finds "Chest-Supported Dumbbell Row (Elbows-Out)".
 */
export function exerciseResolver(exercises: Exercise[]) {
	const key = (name: string) => name.trim().toLowerCase();
	const byName = new Map<string, Exercise>();
	const byAlternative = new Map<string, Exercise[]>();
	const byWords = new Map<string, Exercise[]>();
	for (const exercise of exercises.toSorted((a, b) => Number(a.custom) - Number(b.custom))) {
		if (!byName.has(key(exercise.name))) byName.set(key(exercise.name), exercise);
		for (const alternative of exercise.alternativeNames)
			byAlternative.set(key(alternative), [...(byAlternative.get(key(alternative)) ?? []), exercise]);
		for (const name of [exercise.name, ...exercise.alternativeNames])
			byWords.set(words(name), [...new Set([...(byWords.get(words(name)) ?? []), exercise])]);
	}
	const only = (list: Exercise[] | undefined) => (list?.length === 1 ? list[0] : undefined);
	return (name: string) =>
		byName.get(key(name)) ?? only(byAlternative.get(key(name))) ?? only(byWords.get(words(name)));
}

type Template = { id: string; name: string; blocks: { exercises: { exerciseID: string }[] }[] };

/** The template whose exercises overlap the day's most (Jaccard, at least half), for the session's name and order. */
function bestTemplate(ids: string[], templates: Template[]) {
	let best: { template: Template; score: number } | undefined;
	for (const template of templates) {
		const own = new Set(template.blocks.flatMap(block => block.exercises.map(item => item.exerciseID)));
		const shared = ids.filter(id => own.has(id)).length;
		const score = shared / new Set([...ids, ...own]).size;
		if (score >= 0.5 && (!best || score > best.score)) best = { template, score };
	}
	return best?.template;
}

export async function importMacroFactorWorkouts(options: {
	server: string;
	token: string;
	files: string[];
	dryRun?: boolean;
}): Promise<{ counts: Counts; warnings: string[]; worstVolumeDriftPercent: number }> {
	const api = client(options.server, options.token);
	const root = await api('GET', '');
	if (!root.authenticated) throw new Error('The server did not accept the token');
	const days = parseWorkoutDays(options.files.map(readExport));
	const resolve = exerciseResolver((await every(api, '/exercises?includeArchived=true', 500)) as unknown as Exercise[]);
	const templates = (await api('GET', '/templates')) as Template[];
	const sessions = await every(api, '/sessions', 200);
	const sessionIds = new Set(sessions.map(session => String(session.id)));
	const busyDays = new Set(sessions.map(session => String(session.startedAt).slice(0, 10)));

	const warnings: string[] = [];
	const unmatched = new Set<string>();
	const count = { created: 0, updated: 0, unchanged: 0, skipped: 0 };
	const writes: (() => Promise<unknown>)[] = [];
	let worstVolumeDriftPercent = 0;

	for (const [day, exercises] of [...days].toSorted(([a], [b]) => a.localeCompare(b))) {
		const id = stableId('workout-session', day);
		if (sessionIds.has(id)) {
			count.unchanged++;
			continue;
		}
		if (busyDays.has(day)) {
			count.skipped++;
			warnings.push(`${day}: a session is already logged that day, so MacroFactor's is not added`);
			continue;
		}
		const items = [...exercises].flatMap(([name, totals]) => {
			const exercise = resolve(name);
			if (!exercise) unmatched.add(name);
			return exercise ? [{ exercise, totals }] : [];
		});
		if (!items.length) continue;
		const template = bestTemplate(
			items.map(item => item.exercise.id),
			templates,
		);
		const order = template?.blocks.flatMap(block => block.exercises.map(item => item.exerciseID)) ?? [];
		const position = (exerciseId: string) => (order.includes(exerciseId) ? order.indexOf(exerciseId) : order.length);
		items.sort(
			(a, b) => position(a.exercise.id) - position(b.exercise.id) || a.exercise.name.localeCompare(b.exercise.name),
		);

		let setCount = 0;
		const blocks = items.map(({ exercise, totals }) => {
			const perSide = exercise.metrics.some(metric => metric.includes('PerSide'));
			const sets = rebuildSets(totals, perSide);
			const off = drift(totals, sets, perSide);
			if (off.sets || off.reps || off.heaviest) throw new Error(`${day} ${exercise.name}: ${JSON.stringify(off)}`);
			worstVolumeDriftPercent = Math.max(worstVolumeDriftPercent, Math.abs(off.volumePercent));
			setCount += sets.length;
			return {
				exercises: [
					{
						exerciseID: exercise.id,
						sets: sets.map(set => ({
							type: 'standard',
							log: {
								...(set.weight !== undefined && { weightKg: set.weight * KG_PER[totals.unit] }),
								...(set.reps !== undefined && { reps: set.reps }),
								...(set.durationSeconds !== undefined && { durationSeconds: set.durationSeconds }),
							},
						})),
					},
				],
			};
		});
		const startedAt = `${day}${START_UTC}`;
		const seconds = items.length * SETUP_SECONDS_PER_EXERCISE + setCount * SECONDS_PER_SET;
		const body = {
			id,
			name: template?.name ?? 'Workout',
			templateId: template?.id ?? null,
			startedAt,
			endedAt: new Date(Date.parse(startedAt) + seconds * 1000).toISOString(),
			notes:
				"Imported from MacroFactor. Each exercise's sets, reps, heaviest weight, and volume match MacroFactor's totals for the day; the split across sets is estimated.",
			blocks,
			gymId: null,
		};
		count.created++;
		writes.push(() => api('POST', '/sessions', body));
	}
	for (const name of unmatched) warnings.push(`"${name}" matched no exercise, so its sets are left out`);
	if (!options.dryRun) await pool(writes, 4);
	return { counts: { workout_sessions: count }, warnings, worstVolumeDriftPercent };
}

if (import.meta.main) {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: { server: { type: 'string' }, 'dry-run': { type: 'boolean', default: false } },
	});
	const token = process.env.OWNER_TOKEN;
	if (!values.server || !token || !positionals.length) {
		console.error(
			'Usage: OWNER_TOKEN=<token> bun scripts/import-macrofactor-workouts.ts --server <url> <granular.xlsx...> [--dry-run]',
		);
		process.exit(2);
	}
	const { counts, warnings, worstVolumeDriftPercent } = await importMacroFactorWorkouts({
		server: values.server,
		token,
		files: positionals,
		dryRun: values['dry-run'],
	});
	for (const warning of warnings) console.warn(`warning: ${warning}`);
	console.log(format(counts));
	console.log(`Largest volume difference from MacroFactor's totals: ${worstVolumeDriftPercent.toFixed(1)}%`);
	if (values['dry-run']) console.log('Dry run: nothing was written.');
}
