import { describe, expect, test } from 'bun:test';
import { sha256Hex } from '../auth';
import { testServer } from '../testing';

const { config, call: callAs, ok: okAs, phone, phoneWrites } = testServer();

const BOT = 'abm_test-token-for-the-coach';
const BENCH = '19f5c6f170d8808bb424e98de4472a7e';

const call = (method: string, path: string, body?: unknown, token: string | null = BOT) =>
	callAs(method, path, body, token);
const ok = <T = any>(method: string, path: string, body?: unknown) => okAs<T>(method, path, body, BOT);

describe('agent API', () => {
	test('every route but the root needs a token, the OpenAPI document included', async () => {
		const open = await call('GET', '', undefined, null);
		expect([open.status, (await open.json()).authenticated]).toEqual([200, false]);
		for (const [path, token] of [
			['/openapi.json', null],
			['/templates', 'abm_unknown'],
			['/food-database/search?q=egg', null],
		] as const) {
			expect({ path, status: (await call('GET', path, undefined, token)).status }).toEqual({ path, status: 401 });
		}
		expect((await call('GET', '/openapi.json', undefined, config.ownerToken)).status).toBe(200);
	});

	test('a token made on the phone works once synced, and stops working once revoked', async () => {
		expect((await call('GET', '/programs')).status).toBe(401);
		await phoneWrites([
			{
				seq: 1,
				table: 'api_tokens',
				id: 'token-1',
				op: 'put',
				values: {
					name: 'Coach',
					token_hash: await sha256Hex(BOT),
					hint: 'abm_test',
					created_at: '2026-10-24T09:00:00.000Z',
				},
			},
		]);

		const root = await ok('GET', '');
		expect(root).toMatchObject({ authenticated: true, actor: { kind: 'bot', name: 'Coach' } });

		const sync = await call('POST', '/sync', { protocol: 1, client: 'bot', cursor: 0, writes: [] });
		expect(sync.status).toBe(401);

		await phoneWrites([{ seq: 2, table: 'api_tokens', id: 'token-1', op: 'delete' }]);
		expect((await call('GET', '/programs')).status).toBe(401);
		await phoneWrites([
			{
				seq: 3,
				table: 'api_tokens',
				id: 'token-2',
				op: 'put',
				values: { name: 'Coach', token_hash: await sha256Hex(BOT), created_at: '2026-10-24T09:00:00.000Z' },
			},
		]);
	});

	test('a program built through the API reaches the phone in the shape the app decodes', async () => {
		const created = await ok('POST', '/programs', {
			name: 'Strength',
			cycles: 4,
			activate: true,
			days: [
				{
					template: {
						name: 'Bench Day',
						blocks: [{ exercises: [{ exerciseID: BENCH, sets: [{ target: { repsMin: 5, repsMax: 8, rir: 2 } }] }] }],
					},
				},
				{},
			],
		});
		expect(created).toMatchObject({ active: true, currentCycle: 1, upNext: { cycle: 1 } });
		expect(created.days[1]).toEqual({ id: expect.any(String) });
		expect(created.upNext.templateId).toBe(created.templates[0].id);

		const [program] = await phone('programs');
		expect(program).toMatchObject({ name: 'Strength', active: 1, cycles: 4 });
		const [template] = (await phone('workout_templates')).filter(row => row?.program_id === created.id);
		const blocks = JSON.parse(String(template!.blocks));
		expect(blocks[0].exercises[0]).toEqual({
			exerciseID: BENCH,
			id: expect.any(String),
			sets: [{ id: expect.any(String), subSets: [], target: { repsMax: 8, repsMin: 5, rir: 2 }, type: 'standard' }],
		});
		expect(String(template!.blocks)).toStartWith('[{"exercises":[{"exerciseID"');

		const logged = await ok('POST', '/sessions', {
			templateId: created.templates[0].id,
			program: { programId: created.id, dayId: created.days[0].id, cycle: 1 },
			startedAt: '2026-10-24T08:00:00Z',
			endedAt: '2026-10-24T09:00:00Z',
		});
		expect(logged).toMatchObject({ name: 'Bench Day', startedAt: '2026-10-24T08:00:00.000Z', cycle: 1 });

		const done = structuredClone(logged.blocks);
		done[0].exercises[0].sets[0].log = { weightKg: 100, reps: 6, rir: 2 };
		await ok('PATCH', `/sessions/${logged.id}`, { blocks: done });
		const history = await ok('GET', `/exercises/${BENCH}/history`);
		expect(history.total).toBe(1);
		expect(history.items[0].sets[0].log).toEqual({
			weightKg: 100,
			reps: 6,
			rir: 2,
			completedAt: '2026-10-24T09:00:00.000Z',
		});
		expect(history.items[0].stats).toMatchObject({ loggedSets: 1, workingSets: 1, volumeKg: 600, bestReps: 6 });
		expect(history.items[0].stats.bestEstimatedOneRepMaxKg).toBeCloseTo(126.67, 2);
	});

	test('a gym lists the exercises its plurals and bodyweight allow, as the app does', async () => {
		const gym = await ok('POST', '/gyms', {
			name: 'Pull-Up Corner',
			equipment: { '19e5c6f170d8808593d8ecf408c4f749': {}, '25e5c6f170d8808e8276fa6902887bff': {} },
		});
		const names = async (q: string) =>
			(await ok('GET', `/exercises?gymId=${gym.id}&q=${q}&limit=500`)).items.map((e: { name: string }) => e.name);
		expect(await names('chin-up')).toContain('Chin-Up');
		expect(await names('dumbbell')).toContain('Dumbbell Turkish Get-Up');
		expect(await names('dumbbell')).toContain('Standing Dumbbell Overhead Press');
		expect(await names('barbell')).not.toContain('Barbell Back Squat');
		await ok('DELETE', `/gyms/${gym.id}`);
	});

	test('bad input, a second live session, and a taken id are refused before they reach the phone', async () => {
		const unknown = await call('POST', '/templates', {
			name: 'X',
			blocks: [{ exercises: [{ exerciseID: 'nope', sets: [] }] }],
		});
		expect(unknown.status).toBe(422);

		const invalid = await call('POST', '/gyms', { name: 'Home', equipment: { x: { load: { base: { kg: -1 } } } } });
		expect(invalid.status).toBe(400);

		await ok('POST', '/sessions', { name: 'Live', startedAt: '2026-10-24T10:00:00Z' });
		expect((await call('POST', '/sessions', { name: 'Again', startedAt: '2026-10-24T10:05:00Z' })).status).toBe(409);

		const imported = {
			id: 'A1B2C3D4-0000-4000-8000-000000000001',
			name: 'Imported',
			startedAt: '2026-01-09T17:00:00Z',
			endedAt: '2026-01-09T18:00:00Z',
		};
		expect((await ok('POST', '/sessions', imported)).id).toBe('a1b2c3d4-0000-4000-8000-000000000001');
		expect((await call('POST', '/sessions', imported)).status).toBe(409);
	});

	test('program sessions follow the deload and the run, as the app does', async () => {
		const sets = (reps: number, count: number) =>
			Array.from({ length: count }, () => ({ target: { repsMin: reps, repsMax: reps, rir: 1 } }));
		const created = await ok('POST', '/programs', {
			name: 'Deload First',
			cycles: 2,
			config: { deload: 'firstCycle', periodization: true },
			days: [
				{
					template: {
						name: 'Day',
						blocks: [
							{
								exercises: [
									{ exerciseID: BENCH, sets: sets(10, 3), cycleTargets: [{ sets: sets(10, 3) }, { sets: sets(5, 3) }] },
								],
							},
						],
					},
				},
				{},
			],
		});
		const start = (cycle: number) =>
			ok('POST', '/sessions', {
				templateId: created.templates[0].id,
				program: { programId: created.id, dayId: created.days[0].id, cycle },
				startedAt: '2026-10-20T08:00:00Z',
				endedAt: '2026-10-20T09:00:00Z',
			});
		const deloaded = await start(1);
		expect(deloaded.blocks[0].exercises[0].sets.map((set: any) => set.target)).toEqual([
			{ repsMin: 8, repsMax: 8, rir: 4 },
			{ repsMin: 8, repsMax: 8, rir: 4 },
		]);
		expect(deloaded.blocks[0].exercises[0].cycleTargets).toBeUndefined();
		expect((await start(3)).blocks[0].exercises[0].sets[0].target).toEqual({ repsMin: 5, repsMax: 5, rir: 1 });

		expect((await ok('GET', `/programs/${created.id}`)).upNext).toMatchObject({
			dayId: created.days[1].id,
			templateId: null,
		});
		const restarted = await ok('POST', `/programs/${created.id}/activate`);
		expect(restarted.upNext).toEqual({ dayId: created.days[0].id, templateId: created.templates[0].id, cycle: 1 });
	});

	test('templates refuse logged sets', async () => {
		const logged = [{ exercises: [{ exerciseID: BENCH, sets: [{ log: { reps: 8 } }] }] }];
		expect((await call('POST', '/templates', { name: 'X', blocks: logged })).status).toBe(400);
		expect(
			(await call('POST', '/programs', { name: 'P', cycles: 1, days: [{ template: { name: 'X', blocks: logged } }] }))
				.status,
		).toBe(400);
	});

	test('an id works in either case on every route', async () => {
		const id = 'A1B2C3D4-0000-4000-8000-00000000000A';
		const created = await ok('POST', '/body-weights', { id, measuredAt: '2026-01-02T08:00:00.000Z', weightKg: 80 });
		expect(created.id).toBe(id.toLowerCase());
		expect((await ok('GET', `/body-weights/${id}`)).weightKg).toBe(80);
		expect((await ok('PATCH', `/body-weights/${id}`, { weightKg: 81 })).weightKg).toBe(81);
		expect((await ok('DELETE', `/body-weights/${id}`)).deleted).toBe(id.toLowerCase());

		const foodId = 'B1B2C3D4-0000-4000-8000-00000000000B';
		const nutrition = { nutrients: { k: 100 }, measures: [{ name: 'serving', quantity: 1, servings: 1 }] };
		await ok('POST', '/foods', { id: foodId, name: 'Upper', nutrition });
		await ok('POST', '/food-entries', { foodId, day: '2026-01-02', minute: 480 });
		expect((await ok('GET', `/food-entries?foodId=${foodId}`)).items).toHaveLength(1);
	});

	test('settings patch the synced row the app reads', async () => {
		const updated = await ok('PATCH', '/settings', {
			weightUnit: 'kg',
			rest: { core: 45 },
			profile: { bodyWeightKg: 80 },
		});
		expect(updated).toMatchObject({
			weightUnit: 'kg',
			rest: { core: 45, compoundLower: 180 },
			profile: { bodyWeightKg: 80 },
		});
		expect(await phone('settings')).toEqual([
			expect.objectContaining({ weight_unit: 'kg', rest_core: 45, profile: '{"bodyWeightKg":80}' }),
		]);
	});
});
