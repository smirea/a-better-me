import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bunSqlite } from 'sync-engine/bun-sqlite';
import { createSpace, handleSync } from 'sync-engine/core';
import registry from '../app-ios/Sources/App/Resources/Nutrition/nutrients.json';
import { handleAgent } from '../server/src/agent';
import { handle, type App } from '../server/src/api';
import { parseConfig } from '../server/src/config';
import { schema } from '../shared/db/schema';
import { importMacroFactor, NUTRIENT_COLUMNS, parseCsv, stableId } from './import-macrofactor';
import { writeXlsx, type Sheet } from './xlsx';

/** A made-up account: three days in January 2026 (Excel serials 46030 to 46032), none of it the owner's. */
const GRANULAR: Record<string, Sheet> = {
	'Calories & Macros': [
		['Date', 'Calories (kcal)', 'Fat (g)', 'Carbs (g)', 'Protein (g)'],
		[46030, 2000, 70, 200, 150],
		[46031, 1800, 60, 180, 140],
	],
	Micronutrients: [
		['Date', 'Fiber (g)', 'Sodium (mg)'],
		[46030, 30, null],
	],
	'Scale Weight': [
		['Date', 'Weight (lb)', 'Fat Percent'],
		[46030, 200, 25],
		[46031, 199.5, null],
	],
	'Body Metrics': [
		['Date', 'Waist (in)', 'Visual Body Fat Assessment'],
		[46030, 34, 20],
	],
	Steps: [
		['Date', 'Steps'],
		[46030, 8000],
	],
	'Custom Foods': [
		[
			'Food Name',
			'Serving Size',
			'Serving Qty',
			'Serving Weight (g)',
			'Calories (kcal)',
			'Fat (g)',
			'Carbs (g)',
			'Protein (g)',
		],
		['Test Granola', 'cup', 1, 60, 250, 8, 40, 6],
		['Empty Food', null, null, null, null, null, null, null],
		['Test Bowl', 'serving', 1, 200, 350, 10, 50, 10],
	],
	Recipes: [
		[
			'Recipe Name',
			'Total Weight (g)',
			'Serving Qty',
			'Ingredients',
			'Preparation Time (min)',
			'Cooking Time (min)',
			'Description',
			'Calories (kcal)',
			'Protein (g)',
			'Fat (g)',
			'Carbs (g)',
			'Step 1',
			'Step 2',
		],
		[
			'Test Bowl',
			400,
			2,
			'Test Granola (2 cup)\nMystery Milk (1 cup)',
			'5',
			null,
			'Mix it',
			700,
			20,
			20,
			100,
			'Pour',
			'Eat',
		],
	],
	Fasting: [
		['Date', 'Fasting'],
		['1/10/2026', 'Yes'],
		['1/8/2026', 'No'],
	],
	'Partial Logging': [
		['Date', 'Partial Logging'],
		['1/8/2026', 'No'],
	],
	'Nutrition Program Settings': [
		[
			'Program Update Date',
			'Program Weekday',
			'Calories (kcal)',
			'Fat (g)',
			'Protein (g)',
			'Carbs (g)',
			'Expenditure (kcal)',
			'Daily Average (kcal)',
			'Weight (lb)',
			'Expenditure Calculation Mode',
		],
		...['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(weekday => [
			'1/5/2026',
			weekday,
			weekday === 'Saturday' ? 2400 : 2000,
			60,
			160,
			weekday === 'Saturday' ? 300 : 200,
			2500,
			2057,
			200,
			'Dynamic',
		]),
	],
	'Weight Goals': [
		['Goal', 'Status', 'Start Date', 'End Date', 'Goal Weight (lb)', 'Goal Rate per Week (%)'],
		['Weight Loss', 'In Progress', '1/1/2026', null, 180, 0.5],
	],
	'User Profile': [
		['Name', 'Sex', 'Birthday', 'Height (in)'],
		['Test Person', 'Male', '1990-05-01', 180],
	],
	Favorites: [['Food Name', 'Serving Size']],
	'Food Log Notes': [
		['Date', 'Exercise Name', 'Food Log Notes'],
		[46030, null, 'Felt fine'],
	],
};

const FOOD_LOG_HEADER = [
	'Date',
	'Time',
	'Food Name',
	'Serving Size',
	'Serving Qty',
	'Serving Weight (g)',
	'Calories (kcal)',
	'Fat (g)',
	'Carbs (g)',
	'Protein (g)',
];
const LOG: Sheet = [
	['2026-01-09', '08:15 AM', 'Test Granola', 'cup', 0.5, 60, 125, 4, 20, 3],
	['2026-01-09', '08:15 AM', 'Test Granola', 'cup', 0.5, 60, 125, 4, 20, 3],
	['2026-01-09', '12:30 PM', 'Quick Add', 'serving', 1, null, 300, 10, 30, 20],
	['2026-01-09', '06:00 PM', 'Test Bowl', 'serving', 1, 200, 350, 10, 50, 10],
];

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
const server = Bun.serve({ port: 0, fetch: request => handle(request, app) });
afterAll(() => server.stop(true));

const directory = mkdtempSync(join(tmpdir(), 'macrofactor-'));
function file(name: string, sheets: Record<string, Sheet>) {
	const path = join(directory, name);
	writeFileSync(path, writeXlsx(sheets));
	return path;
}
const granular = file('granular.xlsx', GRANULAR);
const quick = file('quick.xlsx', { 'Quick Export': [['Date']], 'Food Log': [FOOD_LOG_HEADER, ...LOG] });

const run = (files: string[], dryRun = false) =>
	importMacroFactor({ server: server.url.href, token: config.ownerToken, files, dryRun });
async function get(path: string) {
	const response = await fetch(new URL(`/api${path}`, server.url), {
		headers: { authorization: `Bearer ${config.ownerToken}` },
	});
	return response.json() as Promise<any>;
}
const row = (created: number, updated = 0, unchanged = 0, skipped = 0) => ({ created, updated, unchanged, skipped });
const round = (amounts: Record<string, number>) =>
	Object.fromEntries(Object.entries(amounts).map(([key, value]) => [key, Math.round(value * 1e6) / 1e6]));

const granola = stableId('food', 'Test Granola', 0);
const bowl = stableId('recipe', 'Test Bowl', 0);

describe('import-macrofactor', () => {
	test('every export nutrient column maps to a registry id, one to one', () => {
		const ids = new Set(registry.map(nutrient => nutrient.id));
		expect(Object.values(NUTRIENT_COLUMNS).filter(id => !ids.has(id))).toEqual([]);
		expect(new Set(Object.values(NUTRIENT_COLUMNS)).size).toBe(ids.size);
	});

	test('a dry run counts what it would write and writes nothing', async () => {
		const { counts } = await run([granular, quick], true);
		expect(counts.food_entries).toEqual(row(4));
		expect(await get('/foods')).toEqual({ total: 0, items: [] });
	});

	test('the first run creates every row, and a second creates none', async () => {
		const first = await run([granular, quick]);
		expect(first.counts).toEqual({
			foods: row(1, 0, 0, 2),
			recipes: row(1),
			food_entries: row(4),
			body_weights: row(2),
			body_metrics: row(3),
			nutrition_days: row(2),
			nutrition_plans: row(1),
			settings: row(0, 1),
		});
		expect(first.warnings).toEqual(['Food Log Notes: 1 rows not imported (the importer does not read this sheet yet)']);

		const second = await run([granular, quick]);
		expect(second.counts).toEqual({
			foods: row(0, 0, 1, 2),
			recipes: row(0, 0, 1),
			food_entries: row(0, 0, 4),
			body_weights: row(0, 0, 2),
			body_metrics: row(0, 0, 3),
			nutrition_days: row(0, 0, 2),
			nutrition_plans: row(0, 0, 1),
			settings: row(0, 0, 1),
		});
	});

	test('rows land in the shapes the app reads', async () => {
		const day = await get('/food-log/2026-01-09');
		expect(day.override).toBeNull();
		expect(
			day.entries.map((entry: any) => [entry.minute, entry.food.name, entry.food.source, entry.food.foodID]),
		).toEqual([
			[495, 'Test Granola', 'custom', granola],
			[495, 'Test Granola', 'custom', granola],
			[750, 'Quick Add', 'quick_add', undefined],
			[1080, 'Test Bowl', 'recipe', bowl],
		]);
		expect(day.entries[0].food.nutrition).toEqual({
			nutrients: { k: 250, f: 8, c: 40, p: 6 },
			baseGrams: 60,
			measures: [{ name: 'cup', quantity: 1, servings: 1 }],
		});
		expect(day.entries[0].serving).toEqual({ measure: { name: 'cup', quantity: 1, servings: 1 }, quantity: 0.5 });
		expect(round(day.totals)).toEqual({ k: 900, f: 28, c: 120, p: 36 });

		const recipe = await get(`/recipes/${bowl}`);
		expect(recipe).toMatchObject({
			name: 'Test Bowl',
			servings: 2,
			cookedGrams: 400,
			steps: ['Pour', 'Eat'],
			prepMinutes: 5,
			cookMinutes: null,
			notes: 'Mix it',
		});
		expect(recipe.ingredients.map((ingredient: any) => [ingredient.food.name, ingredient.serving.quantity])).toEqual([
			['Test Granola', 2],
			['Mystery Milk', 1],
			['Other ingredients (MacroFactor totals)', 1],
		]);
		expect(recipe.ingredients[1].food.nutrition.nutrients).toEqual({});
		expect(recipe.ingredients[2].food.nutrition.nutrients).toEqual({ k: 200, p: 8, f: 4, c: 20 });
		expect(recipe.nutrition).toEqual({
			nutrients: { k: 350, p: 10, f: 10, c: 50 },
			baseGrams: 200,
			measures: [{ name: 'serving', quantity: 1, servings: 1 }],
		});

		expect(await get('/nutrition-days')).toEqual([
			{ id: '2026-01-08', status: 'none', override: { k: 2000, f: 70, c: 200, p: 150, '291': 30 } },
			{ id: '2026-01-10', status: 'fasted', override: null },
		]);
		expect((await get('/body-weights')).items).toEqual([
			{
				id: stableId('weight', '2026-01-09'),
				measuredAt: '2026-01-09T12:00:00.000Z',
				weightKg: 90.491677815,
				source: 'manual',
				bodyFatPercent: null,
			},
			{
				id: stableId('weight', '2026-01-08'),
				measuredAt: '2026-01-08T12:00:00.000Z',
				weightKg: 90.718474,
				source: 'manual',
				bodyFatPercent: 25,
			},
		]);
		expect((await get('/body-metrics')).items.map((metric: any) => [metric.id, metric.value])).toEqual([
			['2026-01-08/steps', 8000],
			['2026-01-08/visual_body_fat', 20],
			['2026-01-08/waist', 86.36],
		]);

		const [plan] = await get('/nutrition-plans');
		expect(plan).toMatchObject({
			id: '2026-01-05',
			kind: 'setup',
			goal: { kind: 'lose', ratePercentPerWeek: -0.5, startedOn: '2026-01-01', targetWeightKg: 81.6466266 },
			coaching: { style: 'coached', highDays: [6] },
			expenditureKcal: 2500,
			trendWeightKg: 90.718474,
		});
		expect(plan.targets.map((target: any) => target.energy)).toEqual([2000, 2000, 2000, 2000, 2000, 2400, 2000]);
		expect((await get('/settings')).profile).toEqual({ sex: 'male', birthDate: '1990-05-01', heightCm: 180 });
	});

	test('CSV fields keep quoted commas, quotes, and line breaks, and empty fields are null', () => {
		expect(
			parseCsv('\uFEFF"Date","Food Name","Qty"\r\n"2026-01-09","Rice, ""white""\ncooked",""\n2026-01-10,Egg,2\n'),
		).toEqual([
			['Date', 'Food Name', 'Qty'],
			['2026-01-09', 'Rice, "white"\ncooked', null],
			['2026-01-10', 'Egg', '2'],
		]);
	});

	test('the food log CSV imports the same entries as the Quick Export sheet', async () => {
		const csv = join(directory, 'food-log.csv');
		const quote = (cell: string | number | null) => (cell === null ? '' : `"${String(cell).replaceAll('"', '""')}"`);
		writeFileSync(csv, `\uFEFF${[FOOD_LOG_HEADER, ...LOG].map(cells => cells.map(quote).join(',')).join('\r\n')}\r\n`);
		const { counts } = await run([granular, csv]);
		expect(counts.food_entries).toEqual(row(0, 0, 4));
	});

	test('a weigh-in already stored that day at the same weight is the same reading, and gains the export body fat', async () => {
		await fetch(new URL('/api/body-weights', server.url), {
			method: 'POST',
			headers: { authorization: `Bearer ${config.ownerToken}`, 'content-type': 'application/json' },
			body: JSON.stringify({ weightKg: 95, measuredAt: '2026-02-01T17:00:00Z' }),
		});
		const scale = file('scale.xlsx', {
			'Scale Weight': [
				['Date', 'Weight (kg)', 'Fat Percent'],
				[46054, 95, 22],
			],
		});
		const first = await run([scale]);
		expect(first.counts.body_weights).toEqual(row(0, 1));
		const day = (await get('/body-weights')).items.filter((weighIn: any) =>
			weighIn.measuredAt.startsWith('2026-02-01'),
		);
		expect(day.map((weighIn: any) => [weighIn.measuredAt, weighIn.weightKg, weighIn.bodyFatPercent])).toEqual([
			['2026-02-01T17:00:00.000Z', 95, 22],
		]);
		expect((await run([scale])).counts.body_weights).toEqual(row(0, 0, 0, 1));
	});

	test('an overlapping export adds only its new rows, and a weigh-in already there is not doubled', async () => {
		await fetch(new URL('/api/body-weights', server.url), {
			method: 'POST',
			headers: { authorization: `Bearer ${config.ownerToken}`, 'content-type': 'application/json' },
			body: JSON.stringify({ weightKg: 91, measuredAt: '2026-01-11T12:00:30Z' }),
		});
		const later = file('quick-later.xlsx', {
			'Food Log': [
				FOOD_LOG_HEADER,
				...LOG.slice(1),
				['2026-01-11', '07:00 AM', 'Test Granola', 'cup', 1, 60, 250, 8, 40, 6],
			],
		});
		const weights = file('weights.xlsx', {
			'Scale Weight': [
				['Date', 'Weight (kg)'],
				[46033, 91],
			],
		});
		const { counts } = await run([granular, quick, later, weights]);
		expect(counts.food_entries).toEqual(row(1, 0, 4));
		expect(counts.body_weights).toEqual(row(0, 0, 2, 1));
		expect(counts.nutrition_days).toEqual(row(0, 0, 2));
	});
});
