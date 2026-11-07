import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handle } from '../server/src/api';
import { stableId } from './import-macrofactor';
import { exerciseResolver, importMacroFactorWorkouts, rebuildSets } from './import-macrofactor-workouts';
import { testServer } from '../server/src/testing';
import { writeXlsx, type Sheet } from './xlsx';

const BENCH = '19f5c6f170d8808bb424e98de4472a7e';
const FLY = '1a05c6f170d8806ab70ee93a5c79d733';
const PLANK = '1a45c6f170d880fabcebd578763b9c46';
const PUSH_UP = '1a05c6f170d880a5b43fe13bcb1b6f3a';
const ELBOWS_OUT_ROW = '2ab5c6f170d880839baed369debc0459';
const LB = 0.45359237;

/**
 * A made-up account, none of it the owner's. 2026-01-08 (serial 46030): bench 135x10, 115x12, 122.5x8; fly 25x10 and
 * 20x10 per side; two planks; three push-up sets. 2026-01-09: one row under MacroFactor's older name. 2026-01-10 already
 * holds a session.
 */
const metric = (header: string, values: [number, ...(number | null)[]][]): Sheet => [
	['Date', ...header.split('|')],
	...values,
];
const NAMES =
	'Barbell Bench Press (lb)|Dumbbell Fly (lb)|Forearm Plank (lb)|Push-Up (lb)|Chest-Supported Elbows-Out Dumbbell Row (lb)';
const GRANULAR: Record<string, Sheet> = {
	'Exercises - Total Sets': metric(NAMES.replaceAll('(lb)', '(sets)'), [
		[46030, 3, 2, 2, 3, null],
		[46031, null, null, null, null, 1],
		[46032, 3, null, null, null, null],
	]),
	'Exercises - Total Reps': metric(NAMES.replaceAll('(lb)', '(reps)'), [
		[46030, 30, 20, null, 40, null],
		[46031, null, null, null, null, 12],
		[46032, 30, null, null, null, null],
	]),
	'Exercises - Best Set Reps': metric(NAMES.replaceAll('(lb)', '(reps)'), [
		[46030, 12, 10, null, 15, null],
		[46031, null, null, null, null, 12],
		[46032, 10, null, null, null, null],
	]),
	'Exercises - Heaviest Weight': metric(NAMES, [
		[46030, 135, 25, null, null, null],
		[46031, null, null, null, null, 40],
		[46032, 100, null, null, null, null],
	]),
	'Exercises - Total Volume': metric(NAMES, [
		[46030, 3710, 900, null, 6000, null],
		[46031, null, null, null, null, 960],
		[46032, 3000, null, null, null, null],
	]),
	'Exercises - Best Set Volume': metric(NAMES, [
		[46030, 1380, 500, null, 2250, null],
		[46031, null, null, null, null, 960],
		[46032, 1000, null, null, null, null],
	]),
	'Exercises - Total Duration': metric('Forearm Plank (sec)', [[46030, 120]]),
	'Exercises - Best Set Duration': metric('Forearm Plank (sec)', [[46030, 75]]),
	Workouts: [[null, 'Exercise', 'Notes', 'Set 1 Type', 'Set 1 RIR', 'Set 1 Rest']],
};

const { config, app } = testServer();
const server = Bun.serve({ port: 0, fetch: request => handle(request, app) });
afterAll(() => server.stop(true));

const granular = join(mkdtempSync(join(tmpdir(), 'macrofactor-workouts-')), 'granular.xlsx');
writeFileSync(granular, writeXlsx(GRANULAR));

const run = (dryRun = false) =>
	importMacroFactorWorkouts({ server: server.url.href, token: config.ownerToken, files: [granular], dryRun });
async function api(method: string, path: string, body?: unknown) {
	const response = await fetch(new URL(`/api${path}`, server.url), {
		method,
		headers: { authorization: `Bearer ${config.ownerToken}`, 'content-type': 'application/json' },
		...(body !== undefined && { body: JSON.stringify(body) }),
	});
	if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
	return response.json() as Promise<any>;
}
const loggedSets = (session: any, exerciseID: string) =>
	session.blocks
		.flatMap((block: any) => block.exercises)
		.find((item: any) => item.exerciseID === exerciseID)
		.sets.map((set: any) => set.log);

describe('import-macrofactor-workouts', () => {
	test('rebuilt sets keep the count, reps, top weight, best set, and volume', () => {
		expect(
			rebuildSets(
				{ unit: 'lb', sets: 3, reps: 30, heaviest: 135, volume: 3710, bestVolume: 1380, bestReps: 12 },
				false,
			),
		).toEqual([
			{ weight: 135, reps: 10 },
			{ weight: 115, reps: 12 },
			{ weight: 122.5, reps: 8 },
		]);
		expect(
			rebuildSets({ unit: 'lb', sets: 2, reps: 20, heaviest: 25, volume: 900, bestVolume: 500, bestReps: 10 }, true),
		).toEqual([
			{ weight: 25, reps: 10 },
			{ weight: 20, reps: 10 },
		]);
		expect(
			rebuildSets({ unit: 'lb', sets: 2, reps: 26, heaviest: 70, volume: 1660, bestVolume: 960, bestReps: 16 }, false),
		).toEqual([
			{ weight: 70, reps: 10 },
			{ weight: 60, reps: 16 },
		]);
		expect(rebuildSets({ unit: 'lb', sets: 2, duration: 120, bestDuration: 75 }, false)).toEqual([
			{ durationSeconds: 75 },
			{ durationSeconds: 45 },
		]);
		expect(rebuildSets({ unit: 'lb', sets: 3, reps: 40, bestReps: 15 }, false)).toEqual([
			{ reps: 15 },
			{ reps: 13 },
			{ reps: 12 },
		]);
	});

	test('an older MacroFactor name finds the exercise with the same words in another order', () => {
		const resolve = exerciseResolver([
			{ id: 'a', name: 'Chest-Supported Dumbbell Row (Elbows-Out)', alternativeNames: [], metrics: [], custom: false },
			{ id: 'b', name: 'Dumbbell Row', alternativeNames: ['Row Dumbbell'], metrics: [], custom: false },
			{ id: 'c', name: 'Row Dumbbell Bent', alternativeNames: [], metrics: [], custom: false },
			{ id: 'd', name: 'Bent Row Dumbbell', alternativeNames: [], metrics: [], custom: false },
		]);
		expect(resolve('Chest-Supported Elbows-Out Dumbbell Row')?.id).toBe('a');
		expect(resolve('dumbbell row')?.id).toBe('b');
		expect(resolve('Dumbbell Bent Row')).toBeUndefined();
	});

	test('a dry run counts the days it would log and writes nothing', async () => {
		await api('POST', '/templates', {
			name: 'Push Day',
			blocks: [
				{ exercises: [{ exerciseID: FLY, sets: [{}] }] },
				{ exercises: [{ exerciseID: BENCH, sets: [{}] }] },
				{ exercises: [{ exerciseID: PLANK, sets: [{}] }] },
			],
		});
		await api('POST', '/sessions', {
			name: 'Logged in the app',
			startedAt: '2026-01-10T15:00:00.000Z',
			endedAt: '2026-01-10T16:00:00.000Z',
		});
		const { counts, warnings } = await run(true);
		expect(counts).toEqual({ workout_sessions: { created: 2, updated: 0, unchanged: 0, skipped: 1 } });
		expect(warnings).toEqual(["2026-01-10: a session is already logged that day, so MacroFactor's is not added"]);
		expect((await api('GET', '/sessions')).total).toBe(1);
	});

	test('each day becomes one finished session named after the template it matches', async () => {
		const { counts, worstVolumeDriftPercent } = await run();
		expect(counts).toEqual({ workout_sessions: { created: 2, updated: 0, unchanged: 0, skipped: 1 } });
		expect(worstVolumeDriftPercent).toBe(0);

		const push = await api('GET', `/sessions/${stableId('workout-session', '2026-01-08')}`);
		const template = (await api('GET', '/templates')).find((row: any) => row.name === 'Push Day');
		expect(push.name).toBe('Push Day');
		expect(push.templateId).toBe(template.id);
		expect(push.gymId).toBeNull();
		expect(push.startedAt).toBe('2026-01-08T17:00:00.000Z');
		expect(push.endedAt).toBe('2026-01-08T17:30:30.000Z');
		expect(push.blocks.map((block: any) => block.exercises[0].exerciseID)).toEqual([FLY, BENCH, PLANK, PUSH_UP]);
		expect(
			loggedSets(push, BENCH).map(({ weightKg, reps }: any) => [Math.round((weightKg / LB) * 100) / 100, reps]),
		).toEqual([
			[135, 10],
			[115, 12],
			[122.5, 8],
		]);
		expect(loggedSets(push, PLANK).map((log: any) => log.durationSeconds)).toEqual([75, 45]);
		expect(loggedSets(push, PUSH_UP).map((log: any) => log.reps)).toEqual([15, 13, 12]);
		expect(push.stats.workingSets).toBe(10);
		expect(Math.round(push.stats.exercises.find((e: any) => e.exerciseID === BENCH).volumeKg / LB)).toBe(3710);
		expect(Math.round(push.stats.exercises.find((e: any) => e.exerciseID === FLY).volumeKg / LB)).toBe(900);

		const row = await api('GET', `/sessions/${stableId('workout-session', '2026-01-09')}`);
		expect(row.name).toBe('Workout');
		expect(row.templateId).toBeNull();
		expect(
			loggedSets(row, ELBOWS_OUT_ROW).map(({ weightKg, reps }: any) => [Math.round((weightKg / LB) * 100) / 100, reps]),
		).toEqual([[40, 12]]);
	});

	test('a second run changes nothing', async () => {
		const { counts } = await run();
		expect(counts).toEqual({ workout_sessions: { created: 0, updated: 0, unchanged: 2, skipped: 1 } });
		expect((await api('GET', '/sessions')).total).toBe(3);
	});
});
