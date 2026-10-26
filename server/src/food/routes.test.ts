import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { bunSqlite } from 'sync-engine/bun-sqlite';
import { createSpace, handleSync } from 'sync-engine/core';
import { foodNutrition, schema } from '../../../shared/db/schema';
import { handleAgent } from '../agent';
import { handle, type App } from '../api';
import { parseConfig } from '../config';
import { USER_AGENT } from './openFoodFacts';

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

let requests: Request[] = [];
function stub(answer: (url: URL) => Response) {
	requests = [];
	spyOn(globalThis, 'fetch').mockImplementation((async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = new Request(input, init);
		requests.push(request);
		return answer(new URL(request.url));
	}) as typeof fetch);
}

afterEach(() => {
	(globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe('food database', () => {
	test('a barcode answers the product as the app caches it, per 100 g with the label serving first', async () => {
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
				],
			},
		});
		expect(foodNutrition.safeParse(food.nutrition).success).toBe(true);
		expect(requests.map(request => request.url)).toEqual([
			'https://world.openfoodfacts.org/api/v2/product/3017624010701?fields=code%2Cproduct_name%2Cbrands%2Cnutriments%2Cserving_quantity%2Cserving_quantity_unit%2Cproduct_quantity_unit',
		]);
		expect(requests[0]!.headers.get('user-agent')).toBe(USER_AGENT);
	});

	test('a drink is per 100 mL, energy falls back to kJ, sodium to salt, and alcohol turns into grams', async () => {
		stub(() =>
			Response.json({
				status: 1,
				product: {
					product_name: 'Pale Ale',
					brands: 'Brewery',
					product_quantity_unit: 'ml',
					nutriments: { 'energy-kj_100g': 167.36, carbohydrates_100g: 3, salt_100g: 0.01, alcohol_100g: 5 },
				},
			}),
		);
		const food = await (await call('/food-database/barcode/5000000000017')).json();
		expect(food.nutrition).toEqual({
			nutrients: { k: 40, c: 3, '307': 4, '221': 3.945 },
			baseMilliliters: 100,
			measures: [{ name: 'mL', quantity: 100, servings: 1 }],
		});
	});

	test('an unknown barcode, a product without energy, and a malformed barcode are refused', async () => {
		stub(() => Response.json({ status: 0, status_verbose: 'product not found' }, { status: 404 }));
		expect((await call('/food-database/barcode/5449000000999')).status).toBe(404);

		stub(() => Response.json({ status: 1, product: { product_name: 'Mystery', nutriments: {} } }));
		expect((await call('/food-database/barcode/5449000000999')).status).toBe(404);

		stub(() => Response.json(NUTELLA));
		expect((await call('/food-database/barcode/abc')).status).toBe(400);
		expect(requests).toEqual([]);
	});

	test('search keeps Open Food Facts order and drops products the app could not log', async () => {
		stub(() =>
			Response.json({
				hits: [
					{
						code: '0894700010137',
						product_name: 'Nonfat Greek Yogurt',
						brands: ['Chobani'],
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
					measures: [{ name: 'g', quantity: 100, servings: 1 }],
				},
			},
		]);
		const url = new URL(requests[0]!.url);
		expect([url.origin + url.pathname, url.searchParams.get('q'), url.searchParams.get('page_size')]).toEqual([
			'https://search.openfoodfacts.org/search',
			'greek yogurt',
			'3',
		]);
	});

	test('Open Food Facts failing is a 502, and the routes need a token', async () => {
		stub(() => new Response('busy', { status: 503 }));
		expect((await call('/food-database/search?q=yogurt')).status).toBe(502);

		spyOn(globalThis, 'fetch').mockImplementation((async () => {
			throw new TypeError('network down');
		}) as unknown as typeof fetch);
		expect((await call('/food-database/barcode/3017624010701')).status).toBe(502);

		expect((await call('/food-database/search?q=yogurt', null)).status).toBe(401);
	});
});
