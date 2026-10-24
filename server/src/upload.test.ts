import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { handle } from './api';
import { DEV_OWNER_TOKEN, parseConfig } from './config';
import { migrate } from './db/migrate';
import type { Db } from './db/postgres';

const client = new PGlite();
const db = drizzle(client) as unknown as Db;
const app = { config: parseConfig({ POWERSYNC_URL: 'http://powersync.test' }), db };

beforeAll(async () => {
	await migrate(db);
});
afterAll(() => client.close());
beforeEach(async () => {
	await db.execute(
		sql`TRUNCATE workout_templates, workout_sessions, custom_exercises, exercise_settings, settings, programs, gym_profiles, body_weights`,
	);
});

const send = (writes: unknown[], token: string | null = DEV_OWNER_TOKEN) =>
	handle(
		new Request('http://api.test/api/upload', {
			method: 'POST',
			headers: token ? { authorization: `Bearer ${token}` } : {},
			body: JSON.stringify({ writes }),
		}),
		app,
	);

async function upload(writes: unknown[]) {
	const response = await send(writes);
	expect(response.status).toBe(200);
	return ((await response.json()) as { rejected: { table: string; id: string; reason: string }[] }).rejected;
}

const rows = async (query: string) => (await client.query<Record<string, unknown>>(query)).rows;
const templates = () =>
	rows(
		`SELECT id, name, notes, blocks, to_json(updated_at AT TIME ZONE 'UTC')#>>'{}' AS updated_at FROM workout_templates ORDER BY id`,
	);

/** A template as PowerSync's queue sends a put: snake_case columns, JSON as text, null columns left out. */
const templatePut = (id: string, name: string) => ({
	op: 'put',
	table: 'workout_templates',
	id,
	opId: 1,
	values: {
		name,
		blocks: JSON.stringify([{ id: 'b1', exercises: [] }]),
		created_at: '2026-10-23T09:00:00.000Z',
		updated_at: '2026-10-23T09:00:00.000Z',
	},
});

describe('POST /api/upload', () => {
	test('a put inserts the row with defaults for the columns it leaves out, and a second put replaces it', async () => {
		expect(await upload([templatePut('t1', 'Upper')])).toEqual([]);
		expect(await templates()).toEqual([
			{
				id: 't1',
				name: 'Upper',
				notes: '',
				blocks: [{ id: 'b1', exercises: [] }],
				updated_at: '2026-10-23T09:00:00',
			},
		]);

		const replaced = templatePut('t1', 'Upper A');
		expect(await upload([{ ...replaced, values: { ...replaced.values, notes: 'heavy', blocks: '[]' } }])).toEqual([]);
		expect(await templates()).toEqual([
			{ id: 't1', name: 'Upper A', notes: 'heavy', blocks: [], updated_at: '2026-10-23T09:00:00' },
		]);
	});

	test('a patch sets only the columns it names', async () => {
		await upload([templatePut('t1', 'Upper')]);
		expect(
			await upload([
				{
					op: 'patch',
					table: 'workout_templates',
					id: 't1',
					values: { notes: 'deload week', updated_at: '2026-10-24T10:30:00Z' },
				},
			]),
		).toEqual([]);
		expect(await templates()).toEqual([
			{
				id: 't1',
				name: 'Upper',
				notes: 'deload week',
				blocks: [{ id: 'b1', exercises: [] }],
				updated_at: '2026-10-24T10:30:00',
			},
		]);
	});

	test('a delete removes the row, and a patch arriving after it changes nothing', async () => {
		await upload([templatePut('t1', 'Upper'), templatePut('t2', 'Lower')]);
		expect(
			await upload([
				{ op: 'delete', table: 'workout_templates', id: 't1' },
				{ op: 'patch', table: 'workout_templates', id: 't1', values: { name: 'Edited offline' } },
			]),
		).toEqual([]);
		expect((await templates()).map(row => row.name)).toEqual(['Lower']);
	});

	test('a retried batch ends in the same state as one delivery', async () => {
		const batch = [
			templatePut('t1', 'Upper'),
			{ op: 'patch', table: 'workout_templates', id: 't1', values: { name: 'Upper B' } },
			templatePut('t2', 'Lower'),
			{ op: 'delete', table: 'workout_templates', id: 't2' },
		];
		await upload(batch);
		const once = await templates();
		expect(await upload(batch)).toEqual([]);
		expect(await templates()).toEqual(once);
		expect(once.map(row => row.name)).toEqual(['Upper B']);
	});

	test('a bad write is rejected alone and the rest of the batch applies', async () => {
		const rejected = await upload([
			templatePut('t1', 'Upper'),
			{ op: 'put', table: 'custom_exercises', id: 'not-custom', values: { exercise: '{"name":"Sled push"}' } },
			{ op: 'put', table: 'settings', id: 'settings', values: { weight_unit: 'stone' } },
			{ op: 'put', table: 'workout_sessions', id: 's1', values: { name: 'Upper' } },
			{ op: 'patch', table: 'exercise_settings', id: 'e1', values: { rest_seconds: 'ninety' } },
			{ op: 'delete', table: 'settings', id: 'settings' },
			{ op: 'put', table: 'workouts', id: 'w1', values: {} },
			templatePut('t2', 'Lower'),
		]);
		expect(rejected.map(({ table, id }) => `${table}/${id}`)).toEqual([
			'custom_exercises/not-custom',
			'settings/settings',
			'workout_sessions/s1',
			'exercise_settings/e1',
			'settings/settings',
			'workouts/w1',
		]);
		expect(rejected[0]!.reason).toContain('custom_exercises_id_prefix');
		expect(rejected.slice(2).map(entry => entry.reason)).toEqual([
			'started_at: required',
			'rest_seconds: expected an integer',
			'Settings cannot be deleted',
			'Unknown table workouts',
		]);
		expect((await templates()).map(row => row.name)).toEqual(['Upper', 'Lower']);
	});

	test('text with U+0000 is rejected, inside JSON too', async () => {
		const put = templatePut('t1', 'Up\u0000per');
		const nested = templatePut('t2', 'Lower');
		const rejected = await upload([
			put,
			{ ...nested, values: { ...nested.values, blocks: JSON.stringify([{ note: 'a\u0000b' }]) } },
		]);
		expect(rejected).toEqual([
			{ table: 'workout_templates', id: 't1', reason: 'Text cannot contain U+0000' },
			{ table: 'workout_templates', id: 't2', reason: 'Text cannot contain U+0000' },
		]);
		expect(await templates()).toEqual([]);
	});

	test('settings and booleans arrive in their SQLite wire shape', async () => {
		expect(
			await upload([
				{ op: 'put', table: 'settings', id: 'settings', values: { weight_unit: 'lb', rest_core: '45' } },
				{
					op: 'put',
					table: 'custom_exercises',
					id: 'custom-1',
					values: { exercise: '{"name":"Sled push"}', is_archived: 1 },
				},
			]),
		).toEqual([]);
		expect(await rows('SELECT weight_unit, rest_core, rest_compound_lower FROM settings')).toEqual([
			{ weight_unit: 'lb', rest_core: 45, rest_compound_lower: 180 },
		]);
		expect(await rows('SELECT exercise, is_archived FROM custom_exercises')).toEqual([
			{ exercise: { name: 'Sled push' }, is_archived: true },
		]);
	});

	test('a program put that leaves out its defaulted columns reads back their defaults', async () => {
		expect(
			await upload([
				{
					op: 'put',
					table: 'programs',
					id: 'p1',
					values: {
						name: 'Hypertrophy',
						color: 'blue',
						icon: 'dumbbell',
						cycles: 4,
						created_at: '2026-10-23T09:00:00.000Z',
						updated_at: '2026-10-23T09:00:00.000Z',
					},
				},
			]),
		).toEqual([]);
		expect(await rows('SELECT config, days, current_cycle, active, archived FROM programs')).toEqual([
			{ config: {}, days: [], current_cycle: 1, active: false, archived: false },
		]);
	});

	test('a program whose days is not an array is refused by the database', async () => {
		const rejected = await upload([
			{
				op: 'put',
				table: 'programs',
				id: 'p1',
				values: {
					name: 'Hypertrophy',
					color: 'blue',
					icon: 'dumbbell',
					cycles: 4,
					days: '{}',
					created_at: '2026-10-23T09:00:00.000Z',
					updated_at: '2026-10-23T09:00:00.000Z',
				},
			},
		]);
		expect(rejected.map(({ table, id }) => `${table}/${id}`)).toEqual(['programs/p1']);
		expect(rejected[0]!.reason).toStartWith('The database refused the write: ');
		expect(rejected[0]!.reason).toContain('programs_days_array');
		expect(await rows('SELECT id FROM programs')).toEqual([]);
	});

	test('a body weight keeps its fractional kilograms, sent as a number or as text', async () => {
		const weight = (id: string, weightKg: unknown) => ({
			op: 'put',
			table: 'body_weights',
			id,
			values: { measured_at: '2026-10-23T07:00:00.000Z', weight_kg: weightKg },
		});
		expect(await upload([weight('w1', 82.35), weight('w2', '82.35')])).toEqual([]);
		expect(await rows('SELECT id, weight_kg, source FROM body_weights ORDER BY id')).toEqual([
			{ id: 'w1', weight_kg: 82.35, source: 'manual' },
			{ id: 'w2', weight_kg: 82.35, source: 'manual' },
		]);
	});

	test('a settings put with one JSON column leaves the others as empty objects', async () => {
		expect(
			await upload([
				{ op: 'put', table: 'settings', id: 'settings', values: { workout: '{"rest":{"enabled":false}}' } },
			]),
		).toEqual([]);
		expect(await rows('SELECT workout, profile, dashboard, shortcuts FROM settings')).toEqual([
			{ workout: { rest: { enabled: false } }, profile: {}, dashboard: {}, shortcuts: {} },
		]);
	});

	test('do_not_recommend patches onto exercise settings put without it', async () => {
		expect(
			await upload([
				{ op: 'put', table: 'exercise_settings', id: 'bench-press', values: { pinned_note: 'Arch' } },
				{ op: 'patch', table: 'exercise_settings', id: 'bench-press', values: { do_not_recommend: 1 } },
			]),
		).toEqual([]);
		expect(await rows('SELECT pinned_note, do_not_recommend, overrides FROM exercise_settings')).toEqual([
			{ pinned_note: 'Arch', do_not_recommend: true, overrides: {} },
		]);
	});

	test('without the owner bearer nothing is written', async () => {
		for (const token of [null, 'wrong-token']) {
			const response = await send([templatePut('t1', 'Upper')], token);
			expect(response.status).toBe(401);
		}
		expect(await templates()).toEqual([]);
	});
});
