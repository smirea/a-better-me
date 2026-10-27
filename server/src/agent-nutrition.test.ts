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

async function status(method: string, path: string, body?: unknown) {
	const response = await call(method, path, body);
	return { status: response.status, error: ((await response.json()) as { error?: string }).error };
}

/** What a phone that synced from scratch holds for one table. */
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

/** Derived amounts are float products; compare them to the micro-unit. */
const round = (amounts: Record<string, number>) =>
	Object.fromEntries(Object.entries(amounts).map(([key, value]) => [key, Math.round(value * 1e6) / 1e6]));

const oats = {
	name: 'Oats',
	nutrition: {
		nutrients: { k: 380, p: 13, f: 7, c: 68, '291': 10 },
		baseGrams: 100,
		measures: [{ name: 'cup', quantity: 1, servings: 0.8 }],
	},
};

describe('nutrition agent API', () => {
	test('foods: custom ids are UUIDs, cached ones are keyed, and an id is created once', async () => {
		const created = await ok('POST', '/foods', oats);
		expect(created).toMatchObject({ source: 'custom', name: 'Oats', brand: null, archived: false });
		expect(created.id).toMatch(/^[0-9a-f-]{36}$/);

		expect(await status('POST', '/foods', { ...oats, source: 'usda' })).toEqual({
			status: 400,
			error: "A usda food's id is `usda-<fdcId>`",
		});
		await ok('POST', '/foods', { ...oats, id: 'usda-173904', source: 'usda', name: 'Oats, USDA' });
		expect((await status('POST', '/foods', { ...oats, id: 'usda-173904', source: 'usda' })).status).toBe(409);

		const patched = await ok('PATCH', `/foods/${created.id}`, { brand: 'Quaker' });
		expect(patched.brand).toBe('Quaker');
		expect((await ok('GET', '/foods?q=quaker')).map((food: any) => food.id)).toEqual([created.id]);
		expect((await ok('GET', '/foods?source=usda')).map((food: any) => food.id)).toEqual(['usda-173904']);

		const row = (await phone('foods')).find(food => food.id === created.id);
		expect(row!.nutrition).toBe(
			'{"baseGrams":100,"measures":[{"name":"cup","quantity":1,"servings":0.8}],"nutrients":{"291":10,"c":68,"f":7,"k":380,"p":13}}',
		);
	});

	test('recipes derive their nutrition per serving from the ingredient snapshots', async () => {
		const food = await ok('POST', '/foods', { ...oats, id: '00000000-0000-4000-8000-000000000001' });
		const milk = {
			source: 'custom',
			name: 'Milk',
			nutrition: { nutrients: { k: 50, p: 3.4, c: 5, nc: 5 }, measures: [{ name: 'mL', quantity: 100, servings: 1 }] },
		};
		const recipe = await ok('POST', '/recipes', {
			name: 'Overnight Oats',
			servings: 2,
			cookedGrams: 500,
			ingredients: [
				{ foodId: food.id, serving: { measure: { name: 'cup', quantity: 1, servings: 0.8 }, quantity: 1 } },
				{ food: milk, serving: { measure: { name: 'mL', quantity: 100, servings: 1 }, quantity: 300 } },
			],
		});
		expect(recipe.ingredients[0].food).toEqual({
			foodID: food.id,
			source: 'custom',
			name: 'Oats',
			nutrition: oats.nutrition,
		});
		expect({ ...recipe.nutrition, nutrients: round(recipe.nutrition.nutrients) }).toEqual({
			nutrients: { k: 227, p: 10.3, f: 2.8, c: 34.7, '291': 4, nc: 30.7 },
			baseGrams: 250,
			measures: [{ name: 'serving', quantity: 1, servings: 1 }],
		});
		expect(
			(await ok('PATCH', `/recipes/${recipe.id}`, { ingredients: [], steps: ['Stir'] })).nutrition.nutrients,
		).toEqual({});
	});

	test('entries snapshot a stored food, scale by their serving, and total by day', async () => {
		const food = await ok('POST', '/foods', { ...oats, name: 'Granola' });
		const logged = await ok('POST', '/food-entries', {
			day: '2026-10-20',
			minute: 480,
			foodId: food.id,
			serving: { measure: { name: 'cup', quantity: 1, servings: 0.8 }, quantity: 0.5 },
		});
		expect(logged).toMatchObject({
			day: '2026-10-20',
			minute: 480,
			food: { foodID: food.id, source: 'custom', name: 'Granola' },
		});
		expect(round(logged.amounts)).toEqual({ k: 152, p: 5.2, f: 2.8, c: 27.2, '291': 4 });
		const quick = await ok('POST', '/food-entries', {
			day: '2026-10-20',
			food: {
				source: 'quick_add',
				name: 'Quick Add',
				nutrition: { nutrients: { k: 100, p: 10 }, measures: [{ name: 'serving', quantity: 1, servings: 1 }] },
			},
		});
		expect(quick.minute).toBe(720);
		expect(quick.serving).toEqual({ measure: { name: 'serving', quantity: 1, servings: 1 }, quantity: 1 });

		expect((await status('POST', '/food-entries', { day: '2026-10-20' })).status).toBe(400);
		expect((await status('POST', '/food-entries', { day: '2026-10-20', foodId: 'nope' })).status).toBe(404);
		expect((await status('POST', '/food-entries', { day: '20-10-2026', foodId: food.id })).status).toBe(400);
		expect((await status('POST', '/food-entries', { id: quick.id, day: '2026-10-20', foodId: food.id })).status).toBe(
			409,
		);

		const day = await ok('GET', '/food-log/2026-10-20');
		expect(day).toMatchObject({ status: 'none', override: null });
		expect(round(day.totals)).toEqual({ k: 252, p: 15.2, f: 2.8, c: 27.2, '291': 4 });
		expect(day.entries.map((entry: any) => entry.id)).toEqual([logged.id, quick.id]);

		await ok('PATCH', `/food-entries/${quick.id}`, { day: '2026-10-21', minute: 60 });
		expect((await ok('GET', '/food-entries?from=2026-10-21&to=2026-10-21')).map((entry: any) => entry.id)).toEqual([
			quick.id,
		]);
		await ok('DELETE', `/food-entries/${quick.id}`);
		expect(await ok('GET', '/food-entries?from=2026-10-21')).toEqual([]);
		const row = (await phone('food_entries')).find(entry => entry.id === logged.id);
		expect(row!.serving).toBe('{"measure":{"name":"cup","quantity":1,"servings":0.8},"quantity":0.5}');
	});

	test('a day is marked or overridden with PUT, and notes stop at five a day', async () => {
		expect(await ok('PUT', '/nutrition-days/2026-10-22', { override: { k: 2000, p: 150 } })).toEqual({
			id: '2026-10-22',
			status: 'none',
			override: { k: 2000, p: 150 },
		});
		await ok('PUT', '/nutrition-days/2026-10-23', { status: 'fasted' });
		expect((await ok('GET', '/nutrition-days?from=2026-10-23')).map((day: any) => day.status)).toEqual(['fasted']);
		expect((await status('PUT', '/nutrition-days/2026-10-24', { override: { k: -1 } })).status).toBe(400);
		await ok('DELETE', '/nutrition-days/2026-10-23');
		expect((await ok('GET', '/food-log/2026-10-23')).status).toBe('none');

		for (const title of ['1', '2', '3', '4', '5']) await ok('POST', '/food-log-notes', { day: '2026-10-22', title });
		expect(await status('POST', '/food-log-notes', { day: '2026-10-22', title: '6' })).toEqual({
			status: 409,
			error: '2026-10-22 already has 5 notes, the most a day takes',
		});
		const notes = await ok('GET', '/food-log-notes?from=2026-10-22&to=2026-10-22');
		expect(notes.find((note: any) => note.title === '1')).toMatchObject({ minute: 720, body: '', color: 'blue' });
	});

	test('favorites keep the newest fifty', async () => {
		const food = await ok('POST', '/foods', { ...oats, name: 'Favorite' });
		const ids: string[] = [];
		for (let index = 0; index < 51; index++) {
			ids.push((await ok('POST', '/food-favorites', { foodId: food.id })).id);
			// Eviction goes by `createdAt`, which has millisecond resolution.
			await Bun.sleep(2);
		}
		const kept = (await ok('GET', '/food-favorites')).map((favorite: any) => favorite.id);
		expect(kept.length).toBe(50);
		expect(kept).not.toContain(ids[0]);
		expect(kept).toContain(ids[50]);
	});

	test('body metrics, plans, and nutrient goals are one row per key', async () => {
		await ok('PUT', '/body-metrics/2026-10-20/waist', { value: 86 });
		const metric = await ok('PUT', '/body-metrics/2026-10-20/waist', { value: 85.5 });
		expect(metric).toMatchObject({ id: '2026-10-20/waist', day: '2026-10-20', kind: 'waist', value: 85.5 });
		expect((await ok('GET', '/body-metrics?kind=waist')).length).toBe(1);
		expect((await status('PUT', '/body-metrics/2026-10-20/elbow', { value: 1 })).status).toBe(400);

		const targets = Array.from({ length: 7 }, () => ({ energy: 2000, protein: 160, fat: 60, carbs: 200 }));
		const goal = { kind: 'lose', targetWeightKg: 80, ratePercentPerWeek: -0.5, startedOn: '2026-10-01' };
		const plan = await ok('PUT', '/nutrition-plans/2026-10-01', { kind: 'setup', goal, targets });
		expect(plan).toMatchObject({
			id: '2026-10-01',
			kind: 'setup',
			coaching: {
				style: 'coached',
				diet: 'balanced',
				protein: 'moderate',
				floor: 'standard',
				training: 'lifting',
				highDays: [],
			},
			expenditureKcal: null,
		});
		const replaced = await ok('PUT', '/nutrition-plans/2026-10-01', {
			kind: 'edit',
			goal,
			targets,
			expenditureKcal: 2500,
		});
		expect(replaced.createdAt).toBe(plan.createdAt);
		expect((await ok('GET', '/nutrition-plans')).map((row: any) => [row.id, row.kind])).toEqual([
			['2026-10-01', 'edit'],
		]);
		expect((await status('PUT', '/nutrition-plans/2026-10-08', { goal, targets: targets.slice(1) })).status).toBe(400);

		await ok('PUT', '/nutrient-goals/2026-10-01/291', { mode: 'custom', floor: 25, ceiling: 60 });
		const reset = await ok('PUT', '/nutrient-goals/2026-10-01/291', { mode: 'auto', floor: 1 });
		expect(reset).toEqual({
			id: '2026-10-01/291',
			nutrient: '291',
			startsOn: '2026-10-01',
			mode: 'auto',
			floor: null,
			target: null,
			ceiling: null,
		});
		expect((await status('PUT', '/nutrient-goals/2026-10-01/fiber', { mode: 'none' })).status).toBe(400);
	});

	test('weigh-ins take a given id and body fat; settings merge the profile and the Nutrition settings', async () => {
		const id = '00000000-0000-4000-8000-0000000000aa';
		const weight = await ok('POST', '/body-weights', {
			id,
			weightKg: 90,
			bodyFatPercent: 20,
			measuredAt: '2026-10-20T12:00:00Z',
		});
		expect(weight).toEqual({
			id,
			weightKg: 90,
			bodyFatPercent: 20,
			measuredAt: '2026-10-20T12:00:00.000Z',
			source: 'manual',
		});
		expect((await status('POST', '/body-weights', { id, weightKg: 91 })).status).toBe(409);
		expect((await ok('PATCH', `/body-weights/${id}`, { weightKg: 89.5 })).weightKg).toBe(89.5);

		await ok('PATCH', '/settings', { nutrition: { checkInWeekday: 3, timeline: { firstHour: 6 } } });
		const settings = await ok('PATCH', '/settings', {
			profile: { heightCm: 180, birthDate: '1990-01-31' },
			nutrition: { timeline: { lastHour: 22 } },
		});
		expect(settings.nutrition).toEqual({ checkInWeekday: 3, timeline: { firstHour: 6, lastHour: 22 } });
		expect(settings.profile).toEqual({ heightCm: 180, birthDate: '1990-01-31' });
		expect((await status('PATCH', '/settings', { nutrition: { checkInWeekday: 8 } })).status).toBe(400);

		await ok('PATCH', '/settings', { nutrition: { standardFloorKcal: 1300, logger: { timeSelection: 'timePad' } } });
		const later = await ok('PATCH', '/settings', {
			nutrition: {
				logger: { optimization: 'context' },
				coachingModules: { fasting: true },
				visibleBodyMetrics: ['waist'],
			},
		});
		expect(later.nutrition).toEqual({
			checkInWeekday: 3,
			timeline: { firstHour: 6, lastHour: 22 },
			standardFloorKcal: 1300,
			logger: { timeSelection: 'timePad', optimization: 'context' },
			coachingModules: { fasting: true },
			visibleBodyMetrics: ['waist'],
		});
		const stripped = await ok('PATCH', '/settings', { nutrition: { searchOpenFoodFacts: true } });
		expect(stripped.nutrition).not.toHaveProperty('searchOpenFoodFacts');
	});

	test('the OpenAPI document lists the nutrition operations', async () => {
		const { paths } = await ok('GET', '/openapi.json');
		expect(Object.keys(paths['/nutrition-plans/{day}'])).toEqual(['get', 'put', 'delete']);
		expect(paths['/food-entries'].post.requestBody.content['application/json'].schema).toEqual({
			$ref: '#/components/schemas/FoodEntryCreate',
		});
	});
});
