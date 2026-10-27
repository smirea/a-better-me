import { describe, expect, test } from 'bun:test';
import { bunSqlite } from 'sync-engine/bun-sqlite';
import { createSpace, handleSync, type SyncResponse } from 'sync-engine/core';
import { schema } from '../../shared/db/schema';
import { handleAgent } from './agent';
import { handle, type App } from './api';
import { parseConfig } from './config';

const driver = bunSqlite(':memory:');
const space = createSpace(driver, schema);
space.migrate();
const config = parseConfig({});
const app: App = {
	config,
	report: { captureMessage: () => undefined, captureException: () => undefined },
	engine: request => handleSync(space, request),
	agent: request => handleAgent(request, { space, driver, ownerToken: config.ownerToken }),
};

const BENCH = '19f5c6f170d8808bb424e98de4472a7e';
const REAR_DELT_FLY = '2a15c6f170d88066b38fd65f8757716f';

const call = (method: string, path: string, body?: unknown) =>
	handle(
		new Request(`http://api.test/api${path}`, {
			method,
			headers: { authorization: `Bearer ${config.ownerToken}`, 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body),
		}),
		app,
	);

async function ok<T = any>(method: string, path: string, body?: unknown): Promise<T> {
	const response = await call(method, path, body);
	const json = await response.json();
	expect({ status: response.status, json }).toMatchObject({ status: 200 });
	return json as T;
}

async function phone(table: string) {
	const response = await handle(
		new Request('http://api.test/api/sync', {
			method: 'POST',
			headers: { authorization: `Bearer ${config.ownerToken}` },
			body: JSON.stringify({ protocol: 1, client: `phone-${crypto.randomUUID()}`, cursor: 0, writes: [] }),
		}),
		app,
	);
	const { rows } = (await response.json()) as SyncResponse;
	return rows.flatMap(row => (row.table === table && !row.deleted ? [row.values] : []));
}

const set = (log: object, type = 'standard') => ({ type, log });
const quick = (kcal: number) => ({
	source: 'quick_add',
	name: 'Quick Add',
	nutrition: { nutrients: { k: kcal }, measures: [{ name: 'serving', quantity: 1, servings: 1 }] },
});

describe('agent API insights', () => {
	test('sessions carry the stats the app derives, and the summary adds them up over a range', async () => {
		await ok('POST', '/sessions', {
			name: 'Push',
			startedAt: '2026-10-20T08:00:00Z',
			endedAt: '2026-10-20T09:00:00Z',
			pausedSeconds: 300,
			blocks: [
				{
					exercises: [
						{
							exerciseID: BENCH,
							sets: [
								set({ weightKg: 60, reps: 5 }, 'warmUp'),
								set({ weightKg: 100, reps: 5, rir: 1 }),
								set({ weightKg: 100, reps: 4, rir: 0 }),
								{ type: 'standard' },
							],
						},
					],
				},
				{ exercises: [{ exerciseID: REAR_DELT_FLY, sets: [set({ weightKg: 10, reps: 12 })] }] },
			],
		});
		await ok('POST', '/sessions', {
			name: 'Bench',
			startedAt: '2026-10-22T08:00:00Z',
			endedAt: '2026-10-22T08:30:00Z',
			blocks: [{ exercises: [{ exerciseID: BENCH, sets: [set({ weightKg: 105, reps: 3, rir: 1 })] }] }],
		});

		const page = await ok('GET', '/sessions?limit=1');
		expect({ total: page.total, names: page.items.map((s: any) => s.name) }).toEqual({ total: 2, names: ['Bench'] });
		const [push] = (await ok('GET', '/sessions?offset=1')).items;
		expect(push.stats).toEqual({
			durationSeconds: 3300,
			workingSets: 3,
			volumeKg: 1440,
			muscleSets: { chest: 2, triceps: 1, front_delts: 1, rear_delts: 1, lats: 0.5, upper_traps: 0.5, upper_back: 0.5 },
			exercises: [
				{
					exerciseID: BENCH,
					name: 'Barbell Bench Press',
					loggedSets: 3,
					workingSets: 2,
					volumeKg: 1200,
					bestReps: 5,
					bestEstimatedOneRepMaxKg: 120,
				},
				{
					exerciseID: REAR_DELT_FLY,
					name: '45° Cable Rear Delt Fly',
					loggedSets: 1,
					workingSets: 1,
					volumeKg: 240,
					bestReps: 12,
					bestEstimatedOneRepMaxKg: 14,
				},
			],
		});

		const summary = await ok('GET', '/training-summary?from=2026-10-19T00:00:00Z&to=2026-10-26T00:00:00Z');
		expect(summary).toMatchObject({ sessions: 2, durationSeconds: 5100, workingSets: 4, volumeKg: 1755 });
		expect(summary.muscleSets.chest).toBe(3);
		expect(summary.exercises[0]).toMatchObject({
			exerciseID: BENCH,
			sessions: 2,
			workingSets: 3,
			bestEstimatedOneRepMaxKg: 120,
		});
		expect((await ok('GET', '/training-summary?from=2026-10-21T00:00:00Z')).sessions).toBe(1);

		const history = await ok('GET', `/exercises/${BENCH}/history?from=2026-10-21T00:00:00Z`);
		expect({ total: history.total, best: history.items[0].stats.bestEstimatedOneRepMaxKg }).toEqual({
			total: 1,
			best: 119,
		});
	});

	test('a rest day ticks done, and a duplicate is an inactive copy with its own templates', async () => {
		const created = await ok('POST', '/programs', {
			name: 'Split',
			cycles: 2,
			activate: true,
			days: [{}, { template: { name: 'Legs', blocks: [{ exercises: [{ exerciseID: BENCH, sets: [{}] }] }] } }],
		});
		const rest = created.days[0].id;
		expect(created.upNext.dayId).toBe(rest);
		const ticked = await ok('POST', `/programs/${created.id}/days/${rest}/rest-done`);
		expect(ticked.days[0]).toEqual({ id: rest, restDoneInCycle: 1 });
		expect(ticked.upNext.dayId).toBe(created.days[1].id);
		expect((await ok('POST', `/programs/${created.id}/days/${rest}/rest-done`, { done: false })).days[0]).toEqual({
			id: rest,
		});
		const workout = await call('POST', `/programs/${created.id}/days/${created.days[1].id}/rest-done`, {});
		expect(workout.status).toBe(422);

		const copy = await ok('POST', `/programs/${created.id}/duplicate`);
		expect(copy).toMatchObject({ name: 'Split Copy', active: false, currentCycle: 1 });
		expect(copy.templates.map((t: any) => [t.name, t.programId])).toEqual([['Legs', copy.id]]);
		expect(copy.templates[0].id).not.toBe(created.templates[0].id);
		const ids = (blocks: any[]) => [blocks[0].id, blocks[0].exercises[0].id, blocks[0].exercises[0].sets[0].id];
		const [original, copied] = [ids(created.templates[0].blocks), ids(copy.templates[0].blocks)];
		expect(copied.filter(id => original.includes(id))).toEqual([]);
		expect(copy.templates[0].blocks[0].exercises[0].exerciseID).toBe(BENCH);
		expect(copy.days[1].templateID).toBe(copy.templates[0].id);
		expect((await ok('GET', `/programs/${created.id}`)).active).toBe(true);
	});

	test('workout settings and exercise overrides merge into the trees the app reads', async () => {
		await ok('PATCH', '/settings', { workout: { rirTracking: false, rest: { scaling: { betweenSides: 40 } } } });
		const settings = await ok('PATCH', '/settings', { workout: { rest: { enabled: false } } });
		expect(settings.workout).toEqual({ rirTracking: false, rest: { enabled: false, scaling: { betweenSides: 40 } } });
		const [row] = await phone('settings');
		expect(row!.workout).toBe('{"rest":{"enabled":false,"scaling":{"betweenSides":40}},"rirTracking":false}');
		expect((await call('PATCH', '/settings', { workout: { warmUp: { automation: 'always' } } })).status).toBe(400);

		const gym = crypto.randomUUID();
		await ok('PATCH', '/settings', { workout: { plateCalculator: { [gym]: { offsetWeight: true } } } });
		const plates = await ok('PATCH', '/settings', {
			workout: { plateCalculator: { [gym.toUpperCase()]: { includeBumperPlates: true } } },
		});
		expect(plates.workout.plateCalculator).toEqual({
			[gym.toUpperCase()]: { offsetWeight: true, includeBumperPlates: true },
		});

		await ok('PATCH', `/exercises/${BENCH}/settings`, {
			overrides: { expandRepRange: false, warmUpAutomation: 'scheme' },
		});
		const cleared = await ok('PATCH', `/exercises/${BENCH}/settings`, {
			pinnedNote: 'Pause on the chest',
			overrides: { expandRepRange: null, warmUpScheme: [{ percent: 50, reps: 5 }] },
		});
		expect(cleared).toEqual({
			pinnedNote: 'Pause on the chest',
			restSeconds: null,
			doNotRecommend: false,
			overrides: { warmUpAutomation: 'scheme', warmUpScheme: [{ percent: 50, reps: 5 }] },
		});
		expect((await ok('GET', `/exercises/${BENCH}`)).settings.overrides.warmUpAutomation).toBe('scheme');
	});

	test('the food log reads as a range of days beside the plan in force', async () => {
		const targets = Array.from({ length: 7 }, (_, index) => ({
			energy: 2000 + index,
			protein: 150,
			fat: 60,
			carbs: 200,
		}));
		const goal = { kind: 'lose', ratePercentPerWeek: -0.5, startedOn: '2026-10-01' };
		await ok('PUT', '/nutrition-plans/2026-10-01', { goal, targets });
		const oats = await ok('POST', '/foods', {
			name: 'Oats',
			nutrition: { nutrients: { k: 380 }, measures: [{ name: 'cup', quantity: 1, servings: 1 }] },
		});
		await ok('POST', '/food-entries', { day: '2026-10-19', foodId: oats.id });
		await ok('POST', '/food-entries', { day: '2026-10-19', food: quick(1200) });
		await ok('PUT', '/nutrition-days/2026-10-20', { status: 'fasted' });
		await ok('POST', '/food-entries', { day: '2026-10-21', food: quick(900) });
		await ok('PUT', '/nutrition-days/2026-10-21', { status: 'partial' });

		const log = await ok('GET', '/food-log?from=2026-10-19&to=2026-10-21');
		expect(
			log.map((day: any) => [day.day, day.entryCount, day.consumed.k ?? 0, day.countedKcal, day.target?.energy]),
		).toEqual([
			['2026-10-19', 2, 1580, 1580, 2000],
			['2026-10-20', 0, 0, 0, 2001],
			['2026-10-21', 1, 900, null, 2002],
		]);
		expect((await ok('GET', '/food-log/2026-10-19')).planId).toBe('2026-10-01');
		expect((await ok('GET', '/nutrition-plans/on/2026-10-25')).target.energy).toBe(2006);
		expect((await call('GET', '/nutrition-plans/on/2026-09-30')).status).toBe(404);
		expect((await ok('GET', `/food-entries?foodId=${oats.id.toUpperCase()}`)).total).toBe(1);
	});

	test('trend weight and expenditure come from the weigh-ins and the log, on the owner calendar', async () => {
		for (const [measuredAt, weightKg] of [
			['2026-10-19T07:00:00Z', 90],
			['2026-10-21T03:00:00Z', 89],
		] as const) {
			await ok('POST', '/body-weights', { measuredAt, weightKg });
		}
		const utc = await ok('GET', '/weight-trend?from=2026-10-19&to=2026-10-21');
		expect(utc.days.map((d: any) => [d.day, d.scaleKg, d.weighedIn])).toEqual([
			['2026-10-19', 90, true],
			['2026-10-20', 89.5, false],
			['2026-10-21', 89, true],
		]);
		const la = await ok('GET', '/weight-trend?from=2026-10-19&to=2026-10-21&tz=America/Los_Angeles');
		expect(la.days.map((d: any) => [d.day, d.weighedIn])).toEqual([
			['2026-10-19', true],
			['2026-10-20', true],
			['2026-10-21', false],
		]);
		expect((await call('GET', '/weight-trend?tz=Mars/Olympus')).status).toBe(400);

		const missing = await ok('GET', '/expenditure');
		expect(missing).toMatchObject({ strategy: null, days: [] });
		expect(missing.missing).toContain('initialKcal');
		await ok('PATCH', '/settings', { nutrition: { expenditure: { initialKcal: 2500 } } });
		const tdee = await ok('GET', '/expenditure?from=2026-10-19&to=2026-10-19');
		expect(tdee).toMatchObject({ start: '2026-10-19', initialKcal: 2500 });
		expect(tdee.days).toEqual([{ day: '2026-10-19', kcal: 2500, holding: true }]);

		const root = await ok('GET', '?tz=America/Los_Angeles');
		expect(root.state).toMatchObject({
			timeZone: 'America/Los_Angeles',
			latestWeighIn: { measuredAt: '2026-10-21T03:00:00.000Z', weightKg: 89 },
			expenditure: { strategy: expect.any(String) },
		});
		expect(typeof root.state.trendWeightKg).toBe('number');
		expect(root.state.nutritionToday.planId).toBe('2026-10-01');
		expect((await call('GET', '?tz=nowhere')).status).toBe(400);
	});

	test('single rows read by id, and the export holds every table but the tokens', async () => {
		const weight = (await ok('GET', '/body-weights')).items[0];
		expect(await ok('GET', `/body-weights/${weight.id}`)).toEqual(weight);
		const note = await ok('POST', '/food-log-notes', { day: '2026-10-19', title: 'Travel' });
		expect(await ok('GET', `/food-log-notes/${note.id}`)).toEqual(note);
		const favorite = await ok('POST', '/food-favorites', { foodId: (await ok('GET', '/foods')).items[0].id });
		expect(await ok('GET', `/food-favorites/${favorite.id}`)).toEqual(favorite);

		const dump = await ok('GET', '/export');
		expect(Object.keys(dump.tables)).not.toContain('api_tokens');
		expect(Object.keys(dump.tables)).toContain('food_entries');
		expect(dump.tables.workout_sessions.length).toBe(2);
		expect(dump.tables.body_weights.map((row: any) => row.weightKg).toSorted()).toEqual([89, 90]);
	});
});
