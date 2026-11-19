import { expect, test } from 'bun:test';
import type { SyncResponse } from 'sync-engine/core';
import { handle } from './api';
import { DEV_OWNER_TOKEN } from './config';
import { testServer } from './testing';

const { space, app } = testServer();

const sync = (client: string, cursor: number, writes: unknown[], token: string | null = DEV_OWNER_TOKEN) =>
	handle(
		new Request('http://api.test/api/sync', {
			method: 'POST',
			headers: token ? { authorization: `Bearer ${token}` } : {},
			body: JSON.stringify({ protocol: 2, client, cursor, writes }),
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

test('sync, the live socket, uploads, and pictures need the owner token', async () => {
	expect((await sync('a', 0, [], null)).status).toBe(401);
	expect((await sync('a', 0, [], 'wrong')).status).toBe(401);
	const live = new Request('http://api.test/api/live', { headers: { upgrade: 'websocket' } });
	expect((await handle(live, app)).status).toBe(401);
	expect((await handle(new Request('http://api.test/api/upload', { method: 'POST' }), app)).status).toBe(401);
	const picture = 'http://api.test/api/images?id=0b0e7a52-6f0c-4b65-9d57-2a0d3c1e9f10';
	expect((await handle(new Request(picture), app)).status).toBe(401);
	expect((await handle(new Request(picture, { method: 'PUT', body: 'x' }), app)).status).toBe(401);
});

test('a template put by one client reaches another client as a full row', async () => {
	const pushed = await synced('a', 0, [{ seq: 1, table: 'workout_templates', id: 't1', op: 'put', values: template }]);
	expect(pushed.acked).toBe(1);
	expect(pushed.rejected).toEqual([]);

	const pulled = await synced('b', 0, []);
	expect(pulled).toEqual({
		space: space.space(),
		head: 1,
		acked: 0,
		rejected: [],
		snapshot: true,
		next: null,
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
	expect(response.rejected.map(r => [r.seq, r.id])).toEqual([[1, 'settings']]);
	expect(response.rows.map(row => [row.id, row.deleted ? null : row.values.weight_unit])).toEqual([['settings', 'lb']]);
});

test('a custom exercise id needs the custom- prefix and settings has the one id', async () => {
	const response = await synced('ids', 0, [
		{ seq: 1, table: 'custom_exercises', id: 'x1', op: 'put', values: { exercise: '{}' } },
		{ seq: 2, table: 'custom_exercises', id: 'custom-x1', op: 'put', values: { exercise: '{}' } },
		{ seq: 3, table: 'settings', id: 'other', op: 'put', values: { weight_unit: 'kg' } },
	]);
	expect(response.rejected.map(r => r.id)).toEqual(['x1', 'other']);
	const mine = new Set(['custom-x1', 'x1', 'other']);
	expect(response.rows.filter(r => mine.has(r.id)).map(r => [r.table, r.id, r.deleted])).toEqual([
		['custom_exercises', 'custom-x1', 0],
		['custom_exercises', 'x1', 1],
		['settings', 'other', 1],
	]);
});
