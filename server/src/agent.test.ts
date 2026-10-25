import { describe, expect, test } from 'bun:test';
import { bunSqlite } from 'sync-engine/bun-sqlite';
import { createSpace, handleSync, type SyncResponse } from 'sync-engine/core';
import { schema } from '../../shared/db/schema';
import { handleAgent, sha256Hex } from './agent';
import { handle, type App } from './api';
import { parseConfig } from './config';

const driver = bunSqlite(':memory:');
const space = createSpace(driver, schema);
space.migrate();
const config = parseConfig({});
const app: App = {
	config,
	engine: request => handleSync(space, request),
	agent: request => handleAgent(request, { space, driver, ownerToken: config.ownerToken }),
};

const BOT = 'abm_test-token-for-the-coach';
const BENCH = '19f5c6f170d8808bb424e98de4472a7e';

const call = (method: string, path: string, body?: unknown, token: string | null = BOT) =>
	handle(
		new Request(`http://api.test/api${path}`, {
			method,
			headers: { ...(token && { authorization: `Bearer ${token}` }), 'content-type': 'application/json' },
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

/** What a phone that synced from scratch now holds. */
async function phone(table: string) {
	const response = await handle(
		new Request('http://api.test/api/sync', {
			method: 'POST',
			headers: { authorization: `Bearer ${config.ownerToken}` },
			body: JSON.stringify({ protocol: 1, client: `phone-${table}`, cursor: 0, writes: [] }),
		}),
		app,
	);
	const { rows } = (await response.json()) as SyncResponse;
	return rows.filter(row => row.table === table).map(row => (row.deleted ? null : row.values));
}

async function phoneWrites(writes: unknown[]) {
	await handle(
		new Request('http://api.test/api/sync', {
			method: 'POST',
			headers: { authorization: `Bearer ${config.ownerToken}` },
			body: JSON.stringify({ protocol: 1, client: 'phone', cursor: space.head(), writes }),
		}),
		app,
	);
}

describe('agent API', () => {
	test('the root explains how to authenticate, and a bad token gets the same instructions', async () => {
		const open = await (await call('GET', '', undefined, null)).json();
		expect(open).toMatchObject({ authenticated: false, openapi: 'http://api.test/api/openapi.json' });
		expect(open.instructions).toContain('Authorization: Bearer abm_');

		const denied = await call('GET', '/templates', undefined, 'abm_unknown');
		expect(denied.status).toBe(401);
		expect((await denied.json()).instructions).toContain('More > API Tokens');
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
		expect(root.openapi.paths['/programs'].post.requestBody).toBeDefined();
		expect(root.openapi.components.schemas.WorkoutBlockInput.required).toEqual(['exercises']);

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
		expect(history[0].sets[0].log).toEqual({ weightKg: 100, reps: 6, rir: 2, completedAt: '2026-10-24T09:00:00.000Z' });
	});

	test('bad input is refused before it can reach the phone', async () => {
		const unknown = await call('POST', '/templates', {
			name: 'X',
			blocks: [{ exercises: [{ exerciseID: 'nope', sets: [] }] }],
		});
		expect(unknown.status).toBe(422);
		expect((await unknown.json()).error).toContain('Unknown exercise ids: nope');

		const invalid = await call('POST', '/gyms', { name: 'Home', equipment: { x: { load: { base: { kg: -1 } } } } });
		expect(invalid.status).toBe(400);

		await ok('POST', '/sessions', { name: 'Live', startedAt: '2026-10-24T10:00:00Z' });
		expect((await call('POST', '/sessions', { name: 'Again', startedAt: '2026-10-24T10:05:00Z' })).status).toBe(409);
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
