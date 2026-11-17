import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { foodNutrition } from '../../../shared/db/schema';
import { handle } from '../api';
import type { RambleItem } from './ramble';
import { testServer } from '../testing';

const { config, app, agent } = testServer();

const call = (path: string, token: string | null = config.ownerToken) =>
	handle(
		new Request(`http://api.test/api${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }),
		app,
	);

/** A trimmed Open Food Facts answer for a real jar, as the product API sends it. */
const NUTELLA = {
	code: '3017624010701',
	status: 1,
	product: {
		code: '3017624010701',
		product_name: 'Nutella',
		brands: 'Ferrero, Nutella',
		serving_quantity: '15',
		product_quantity_unit: 'g',
		quantity: '400 g',
		nutriments: {
			'energy-kcal_100g': 539,
			'energy-kj_100g': 2228,
			proteins_100g: 6.3,
			fat_100g: 30.9,
			'saturated-fat_100g': 10.6,
			carbohydrates_100g: 57.5,
			sugars_100g: 56.3,
			salt_100g: 0.1075,
			sodium_100g: 0.043,
			'vitamin-d_100g': 0.0000025,
			calcium_100g: 0.108,
		},
	},
};

/** Stands in for Open Food Facts and Gemini, answering every request with `answer`. */
function stub(answer: () => Response) {
	spyOn(globalThis, 'fetch').mockImplementation((async () => answer()) as unknown as typeof fetch);
}

afterEach(() => {
	(globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe('food database', () => {
	test('a barcode answers the product as the app caches it, per 100 g with the label serving first and the package last', async () => {
		stub(() => Response.json(NUTELLA));
		const response = await call('/food-database/barcode/3017624010701');
		const food = await response.json();
		expect(response.status).toBe(200);
		expect(food).toEqual({
			id: 'off-3017624010701',
			source: 'open_food_facts',
			name: 'Nutella',
			brand: 'Ferrero',
			barcode: '3017624010701',
			nutrition: {
				nutrients: { k: 539, p: 6.3, f: 30.9, c: 57.5, '269': 56.3, '606': 10.6, '307': 43, '328': 2.5, '301': 108 },
				baseGrams: 100,
				measures: [
					{ name: 'serving', quantity: 1, servings: 0.15 },
					{ name: 'g', quantity: 100, servings: 1 },
					{ name: 'package', quantity: 1, servings: 4 },
				],
			},
		});
		expect(foodNutrition.safeParse(food.nutrition).success).toBe(true);
	});

	test('a drink is per 100 mL, energy falls back to kJ, sodium to salt, alcohol turns into grams, and its oz are fluid', async () => {
		stub(() =>
			Response.json({
				status: 1,
				product: {
					product_name: 'Pale Ale',
					brands: 'Brewery',
					product_quantity_unit: 'ml',
					quantity: '12 oz',
					nutriments: { 'energy-kj_100g': 167.36, carbohydrates_100g: 3, salt_100g: 0.01, alcohol_100g: 5 },
				},
			}),
		);
		const food = await (await call('/food-database/barcode/5000000000017')).json();
		expect(food.nutrition).toEqual({
			nutrients: { k: 40, c: 3, '307': 4, '221': 3.945 },
			baseMilliliters: 100,
			measures: [
				{ name: 'mL', quantity: 100, servings: 1 },
				{ name: 'package', quantity: 1, servings: 3.54882 },
			],
		});
	});

	test('search keeps Open Food Facts order and drops products the app could not log', async () => {
		stub(() =>
			Response.json({
				hits: [
					{
						code: '0894700010137',
						product_name: 'Nonfat Greek Yogurt',
						brands: ['Chobani'],
						quantity: '4 x 5.3 oz',
						nutriments: { 'energy-kcal_100g': 52.9, proteins_100g: 9.41 },
					},
					{ code: '0000000000001', product_name: 'No energy', nutriments: { proteins_100g: 3 } },
					{ code: '0000000000002', nutriments: { 'energy-kcal_100g': 60 } },
				],
			}),
		);
		const response = await call('/food-database/search?q=greek%20yogurt&limit=3');
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual([
			{
				id: 'off-0894700010137',
				source: 'open_food_facts',
				name: 'Nonfat Greek Yogurt',
				brand: 'Chobani',
				barcode: '0894700010137',
				nutrition: {
					nutrients: { k: 52.9, p: 9.41 },
					baseGrams: 100,
					measures: [
						{ name: 'g', quantity: 100, servings: 1 },
						{ name: 'package', quantity: 1, servings: 1.50252 },
					],
				},
			},
		]);
	});
});

const geminiText = (text: string) => Response.json({ candidates: [{ content: { parts: [{ text }] } }] });

const label = (geminiApiKey: string | null, body: unknown) =>
	agent(geminiApiKey)(
		new Request('http://api.test/api/food-database/label', {
			method: 'POST',
			headers: { authorization: `Bearer ${config.ownerToken}` },
			body: JSON.stringify(body),
		}),
	);

describe('food label', () => {
	const front = { image: btoa('front'), mediaType: 'image/jpeg' };
	const panel = { image: btoa('panel'), mediaType: 'image/jpeg' };

	test('a label panel becomes nutrition per printed serving', async () => {
		stub(() =>
			geminiText(
				JSON.stringify({
					name: ' Chicken Tikka Bowl ',
					brand: 'Whole Foods Market',
					store: 'Whole Foods Market',
					serving: { quantity: 1, unit: 'ea', grams: 312, milliliters: null },
					servingsPerContainer: 2,
					nutrients: {
						calories_kcal: 600,
						protein_g: 33,
						total_fat_g: 26,
						sodium_mg: 1000,
						vitamin_d_mcg: 0,
						iron_mg: null,
					},
				}),
			),
		);
		const response = await label('gemini-key', { images: [front, panel] });
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual({
			name: 'Chicken Tikka Bowl',
			brand: 'Whole Foods Market',
			store: 'Whole Foods Market',
			nutrition: {
				nutrients: { k: 600, p: 33, f: 26, '307': 1000, '328': 0 },
				baseGrams: 312,
				measures: [
					{ name: 'ea', quantity: 1, servings: 1 },
					{ name: 'container', quantity: 1, servings: 2 },
				],
			},
		});
		expect(foodNutrition.safeParse(body.nutrition).success).toBe(true);
	});
});

const ramble = (geminiApiKey: string | null, body: unknown) =>
	agent(geminiApiKey)(
		new Request('http://api.test/api/food-database/ramble', {
			method: 'POST',
			headers: { authorization: `Bearer ${config.ownerToken}` },
			body: JSON.stringify(body),
		}),
	);

describe('ramble', () => {
	const body = {
		transcript: "yesterday's breakfast but raspberries instead of blueberries, and my usual coffee",
		today: '2026-10-27',
		time: '08:15',
		meals: [
			{
				id: 'meal-uuid',
				day: '2026-10-26',
				meal: 'breakfast',
				entries: [
					{ id: 'oats-uuid', name: 'Oats', serving: '0.5 cup' },
					{ id: 'blue-uuid', name: 'Blueberries', serving: '50 g' },
				],
			},
		],
		usual: [{ id: 'coffee-uuid', name: 'Coffee', serving: '1 mug' }],
	};
	const item = {
		amount: 0,
		unit: '',
		ref: '',
		scale: 1,
		copy: '',
		except: [],
		meal: '',
		time: '',
		day: null,
		options: false,
		said: '',
	};

	test("the model's short aliases come back as the phone's ids, with the defaults filled in", async () => {
		stub(() =>
			geminiText(
				JSON.stringify({
					items: [
						{ kind: 'copy', name: '', copy: 'm1', except: ['e2'], said: "yesterday's breakfast" },
						{ kind: 'food', name: 'raspberries', amount: 1, unit: 'Cup', meal: 'breakfast', said: ' raspberries ' },
						{ kind: 'food', name: 'coffee', ref: 'u1', time: '8:05' },
					],
				}),
			),
		);
		const response = await ramble('gemini-key', body);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			items: [
				{
					...item,
					kind: 'copy',
					name: '',
					ref: null,
					copy: 'meal-uuid',
					except: ['blue-uuid'],
					meal: 'breakfast',
					said: "yesterday's breakfast",
				},
				{
					...item,
					kind: 'food',
					name: 'raspberries',
					amount: 1,
					unit: 'cup',
					ref: null,
					copy: null,
					meal: 'breakfast',
					said: 'raspberries',
				},
				{ ...item, kind: 'food', name: 'coffee', ref: 'coffee-uuid', copy: null, time: '08:05' },
			],
		});
	});

	test('a copy of no meal, an except outside the copied meal, and a nameless or number-only food are dropped', async () => {
		stub(() =>
			geminiText(
				JSON.stringify({
					items: [
						{ kind: 'copy', name: '', copy: '' },
						{ kind: 'copy', name: '', copy: 'm1', except: ['u1'] },
						{ kind: 'food', name: ' ' },
						{ kind: 'food', name: 'one' },
						{ kind: 'food', name: 'two 3' },
					],
				}),
			),
		);
		expect(await (await ramble('gemini-key', body)).json()).toEqual({
			items: [{ ...item, kind: 'copy', name: '', ref: null, copy: 'meal-uuid', meal: 'breakfast' }],
		});
	});

	test('the same food listed twice at one meal and time is one item with the newer details, a food at another meal is not', async () => {
		stub(() =>
			geminiText(
				JSON.stringify({
					items: [
						{ kind: 'food', name: 'tofu', amount: 200, unit: 'g', meal: 'dinner', said: '200 grams of tofu' },
						{ kind: 'food', name: 'rice', amount: 1, unit: 'cup', meal: 'dinner' },
						{ kind: 'food', name: 'Tofu', amount: 150, unit: 'g', meal: 'dinner', said: 'tofu 150 grams instead' },
						{ kind: 'food', name: 'tofu', amount: 100, unit: 'g', meal: 'lunch' },
					],
				}),
			),
		);
		const { items } = await (await ramble('gemini-key', body)).json();
		expect(
			items.map((item: { name: string; amount: number; meal: string }) => [item.name, item.amount, item.meal]),
		).toEqual([
			['Tofu', 150, 'dinner'],
			['rice', 1, 'dinner'],
			['tofu', 100, 'lunch'],
		]);
	});

	test('a ref to a logged entry whose name lacks a word of the food is dropped, so the food is searched', async () => {
		stub(() =>
			geminiText(
				JSON.stringify({
					items: [
						{ kind: 'food', name: 'apple', ref: 'u1' },
						{ kind: 'food', name: 'coffees', ref: 'u1' },
						{ kind: 'food', name: 'Starbucks coffee', ref: 'u1' },
						{ kind: 'food', name: '365 nonfat milk', ref: 'e2' },
						{ kind: 'food', name: 'Fairlife nonfat milk', ref: 'e2' },
					],
				}),
			),
		);
		const milk = { id: 'milk-uuid', name: 'Organic Nonfat Milk By 365', serving: '200 g' };
		const meal = { id: 'meal-uuid', day: '2026-10-27', meal: 'breakfast', entries: [body.meals[0]!.entries[0]!, milk] };
		const { items } = await (await ramble('gemini-key', { ...body, meals: [meal] })).json();
		expect(items.map((item: { name: string; ref: string | null }) => [item.name, item.ref])).toEqual([
			['apple', null],
			['coffees', 'coffee-uuid'],
			['Starbucks coffee', null],
			['365 nonfat milk', 'milk-uuid'],
			['Fairlife nonfat milk', null],
		]);
	});

	test('a change to a food of a copied meal stands in for that entry, relative changes scale its serving', async () => {
		stub(() =>
			geminiText(
				JSON.stringify({
					items: [
						{ kind: 'copy', copy: 'm1', meal: 'lunch' },
						{ kind: 'food', name: 'potatoes', ref: 'e2', scale: 0.5 },
						{ kind: 'food', name: 'steak', ref: 'e1', amount: 200, unit: 'g', scale: 0.5 },
						{ kind: 'food', name: 'half a pear', scale: 0.5 },
						{ kind: 'food', name: 'broccoli', ref: 'e3', meal: 'dinner' },
						{ kind: 'food', name: 'oats', scale: 1, meal: 'dinner' },
					],
				}),
			),
		);
		const dinner = {
			id: 'dinner-uuid',
			day: '2026-10-26',
			meal: 'dinner',
			entries: [
				{ id: 'steak-uuid', name: 'Beef, top sirloin, steak', serving: '250 g' },
				{ id: 'potato-uuid', name: 'Potato, baked', serving: '1 medium' },
				{ id: 'broc-uuid', name: 'Broccoli, cooked', serving: '1 cup' },
			],
		};
		const { items } = await (await ramble('gemini-key', { ...body, meals: [dinner] })).json();
		expect(
			items.map((item: RambleItem) => [item.kind, item.copy, item.except, item.ref, item.amount, item.scale]),
		).toEqual([
			['copy', 'dinner-uuid', ['potato-uuid', 'steak-uuid'], null, 0, 1],
			['food', null, [], 'potato-uuid', 0, 0.5],
			// A said amount wins over a scale.
			['food', null, [], 'steak-uuid', 200, 1],
			// A scale with no logged food to scale counts the food.
			['food', null, [], null, 0.5, 1],
			// The broccoli from that dinner, eaten at dinner, is no change to the lunch.
			['food', null, [], 'broc-uuid', 0, 1],
			// A scale of 1 is no amount said, so the phone still logs the usual serving.
			['food', null, [], null, 0, 1],
		]);
	});

	test('a said day carries to the items after it, copies included, until another is said', async () => {
		stub(() =>
			geminiText(
				JSON.stringify({
					items: [
						{ kind: 'food', name: 'pizza', day: -1 },
						{ kind: 'copy', copy: 'm1' },
						{ kind: 'food', name: 'beer' },
						{ kind: 'food', name: 'banana', day: 0 },
						{ kind: 'food', name: 'coffee' },
					],
				}),
			),
		);
		const { items } = await (await ramble('gemini-key', body)).json();
		expect(items.map((item: { day: number | null }) => item.day)).toEqual([-1, -1, -1, 0, 0]);
	});
});
