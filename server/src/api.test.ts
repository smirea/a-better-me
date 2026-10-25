import { describe, expect, test } from 'bun:test';
import { bunSqlite } from 'sync-engine/bun-sqlite';
import { createSpace, handleSync, type SyncResponse } from 'sync-engine/core';
import { schema } from '../../shared/db/schema';
import { handleAgent } from './agent';
import { handle, type App, type Report } from './api';
import { DEV_OWNER_TOKEN, parseConfig } from './config';

const driver = bunSqlite(':memory:');
const space = createSpace(driver, schema);
space.migrate();
const config = parseConfig({});
let reports: unknown[][] = [];
const report: Report = {
	captureMessage: (...args) => reports.push(['message', ...args]),
	captureException: (error, context) => reports.push(['exception', String(error), context]),
};
const app: App = {
	config,
	report,
	engine: request => handleSync(space, request),
	agent: request => handleAgent(request, { space, driver, ownerToken: config.ownerToken }),
};

const sync = (client: string, cursor: number, writes: unknown[], token: string | null = DEV_OWNER_TOKEN) =>
	handle(
		new Request('http://api.test/api/sync', {
			method: 'POST',
			headers: token ? { authorization: `Bearer ${token}` } : {},
			body: JSON.stringify({ protocol: 1, client, cursor, writes }),
		}),
		app,
	);

async function synced(client: string, cursor: number, writes: unknown[]): Promise<SyncResponse> {
	const response = await sync(client, cursor, writes);
	expect(response.status).toBe(200);
	return response.json() as Promise<SyncResponse>;
}

const template = {
	name: 'Push',
	notes: '',
	blocks: '[{"id":"b1"}]',
	created_at: '2026-10-24T09:00:00.000Z',
	updated_at: '2026-10-24T09:00:00.000Z',
};

describe('handle', () => {
	test('GET /status is open', async () => {
		const response = await handle(new Request('http://api.test/status'), app);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});

	test('the sync routes need the owner token, anything outside /api is 404', async () => {
		expect((await sync('a', 0, [], null)).status).toBe(401);
		expect((await sync('a', 0, [], 'wrong')).status).toBe(401);
		const live = new Request('http://api.test/api/live', { headers: { upgrade: 'websocket' } });
		expect((await handle(live, app)).status).toBe(401);
		expect((await handle(new Request('http://api.test/upload', { method: 'POST' }), app)).status).toBe(404);
		expect((await handle(new Request('http://api.test/api/upload', { method: 'POST' }), app)).status).toBe(401);
	});

	test('a template put by one client reaches another client as a full row', async () => {
		const pushed = await synced('a', 0, [
			{ seq: 1, table: 'workout_templates', id: 't1', op: 'put', values: template },
		]);
		expect(pushed.acked).toBe(1);
		expect(pushed.rejected).toEqual([]);

		const pulled = await synced('b', 0, []);
		expect(pulled).toEqual({
			head: 1,
			acked: 0,
			rejected: [],
			snapshot: true,
			rows: [
				{
					table: 'workout_templates',
					id: 't1',
					deleted: 0,
					values: { id: 't1', ...template, program_id: null, gym_id: null, archived: 0 },
				},
			],
		});
	});

	test('a value the validator refuses is rejected and the server row comes back', async () => {
		await synced('a', 1, [{ seq: 2, table: 'settings', id: 'settings', op: 'put', values: { weight_unit: 'lb' } }]);
		const response = await synced('b', 1, [
			{ seq: 1, table: 'settings', id: 'settings', op: 'patch', values: { weight_unit: 'stone' } },
		]);
		expect(response.acked).toBe(1);
		expect(response.rejected).toEqual([
			{ seq: 1, table: 'settings', id: 'settings', reason: 'weight_unit: Invalid option: expected one of "kg"|"lb"' },
		]);
		expect(response.rows).toEqual([
			{
				table: 'settings',
				id: 'settings',
				deleted: 0,
				values: {
					id: 'settings',
					weight_unit: 'lb',
					rest_compound_upper: 120,
					rest_compound_lower: 180,
					rest_upper_isolation: 90,
					rest_lower_isolation: 90,
					rest_core: 60,
					workout: '{}',
					profile: '{}',
					dashboard: '{}',
					shortcuts: '{}',
				},
			},
		]);
	});

	test('ids are validated: a custom exercise needs the custom- prefix and settings has one id', async () => {
		const response = await synced('ids', 0, [
			{ seq: 1, table: 'custom_exercises', id: 'x1', op: 'put', values: { exercise: '{}' } },
			{ seq: 2, table: 'custom_exercises', id: 'custom-x1', op: 'put', values: { exercise: '{}' } },
			{ seq: 3, table: 'settings', id: 'other', op: 'put', values: { weight_unit: 'kg' } },
		]);
		expect(response.rejected.map(r => [r.id, r.reason])).toEqual([
			['x1', 'id: Invalid string: must start with "custom-"'],
			['other', 'id: Invalid input: expected "settings"'],
		]);
		const mine = new Set(['custom-x1', 'x1', 'other']);
		expect(response.rows.filter(r => mine.has(r.id)).map(r => [r.table, r.id, r.deleted])).toEqual([
			['custom_exercises', 'custom-x1', 0],
			['custom_exercises', 'x1', 1],
			['settings', 'other', 1],
		]);
	});

	test('a sync with rejected writes reports one warning naming each write and still answers the same body', async () => {
		reports = [];
		const response = await sync('reported', 0, [
			{ seq: 1, table: 'settings', id: 'other', op: 'put', values: { weight_unit: 'kg' } },
			{ seq: 2, table: 'custom_exercises', id: 'x2', op: 'put', values: { exercise: '{}' } },
			{ seq: 3, table: 'custom_exercises', id: 'custom-x2', op: 'put', values: { exercise: '{}' } },
		]);
		expect(response.status).toBe(200);
		expect(((await response.json()) as SyncResponse).acked).toBe(3);
		expect(reports).toEqual([
			[
				'message',
				'Sync rejected writes to custom_exercises, settings',
				{
					level: 'warning',
					extra: {
						rejected: [
							{ seq: 1, table: 'settings', id: 'other', reason: 'id: Invalid input: expected "settings"' },
							{ seq: 2, table: 'custom_exercises', id: 'x2', reason: 'id: Invalid string: must start with "custom-"' },
						],
					},
					fingerprint: ['sync-rejected', 'custom_exercises, settings'],
				},
			],
		]);

		reports = [];
		await synced('reported', 3, []);
		expect(reports).toEqual([]);
	});

	test('a 5xx from the engine is reported as an error', async () => {
		reports = [];
		const failing: App = { ...app, engine: async () => new Response('boom', { status: 503 }) };
		expect(
			(
				await handle(
					new Request('http://api.test/api/sync', {
						method: 'POST',
						headers: { authorization: `Bearer ${DEV_OWNER_TOKEN}` },
					}),
					failing,
				)
			).status,
		).toBe(503);
		expect(reports).toEqual([
			['exception', 'Error: POST /api/sync answered 503', { extra: { route: 'POST /api/sync', status: 503 } }],
		]);
	});
});
