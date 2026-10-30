import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { bunSqlite } from 'sync-engine/bun-sqlite';
import { createSpace, handleSync } from 'sync-engine/core';
import { foodNutrition, schema } from '../../../shared/db/schema';
import { handleAgent } from '../agent';
import { handle, type App } from '../api';
import { parseConfig } from '../config';
import { GEMINI_MODEL } from './mealPhoto';
import { RAMBLE_MODEL } from './ramble';
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

const photo = (geminiApiKey: string | null, body: unknown) =>
	handleAgent(
		new Request('http://api.test/api/food-database/photo', {
			method: 'POST',
			headers: { authorization: `Bearer ${config.ownerToken}` },
			body: JSON.stringify(body),
		}),
		{ space, driver, ownerToken: config.ownerToken, geminiApiKey },
	);

const geminiText = (text: string) => Response.json({ candidates: [{ content: { parts: [{ text }] } }] });

describe('meal photo', () => {
	const image = btoa('not really a jpeg');

	test('Gemini gets the photo, the note, and a schema, and the foods come back with grams', async () => {
		stub(() =>
			geminiText(
				JSON.stringify({
					items: [
						{ name: 'Grilled chicken breast', search: 'chicken breast cooked', grams: 150, confidence: 0.9 },
						{ name: 'Olive oil', search: 'olive oil', grams: 0, confidence: 0.3 },
					],
				}),
			),
		);
		const response = await photo('gemini-key', { image, mediaType: 'image/jpeg', note: 'no skin' });
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			items: [{ name: 'Grilled chicken breast', search: 'chicken breast cooked', grams: 150, confidence: 0.9 }],
		});
		const [request] = requests;
		expect(request!.url).toBe(
			`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
		);
		expect(request!.headers.get('x-goog-api-key')).toBe('gemini-key');
		const sent = await request!.json();
		expect(sent.contents[0].parts[0]).toEqual({ inline_data: { mime_type: 'image/jpeg', data: image } });
		expect(sent.contents[0].parts[1].text).toEndWith("The person's note: no skin");
		expect(sent.generationConfig.responseSchema.required).toEqual(['items']);
	});

	test('no key is a 503 before calling Gemini, and a bad answer or a bad photo is refused', async () => {
		stub(() => geminiText('{}'));
		expect((await photo(null, { image, mediaType: 'image/jpeg' })).status).toBe(503);
		expect(requests).toEqual([]);

		expect((await photo('gemini-key', { image, mediaType: 'image/gif' })).status).toBe(400);
		expect((await photo('gemini-key', { image: 'not base64!', mediaType: 'image/jpeg' })).status).toBe(400);

		expect((await photo('gemini-key', { image, mediaType: 'image/jpeg' })).status).toBe(502);
		stub(() => geminiText('not json'));
		expect((await photo('gemini-key', { image, mediaType: 'image/jpeg' })).status).toBe(502);
		stub(() => Response.json({ promptFeedback: { blockReason: 'SAFETY' } }));
		expect((await photo('gemini-key', { image, mediaType: 'image/jpeg' })).status).toBe(422);
		stub(() => new Response('<html>proxy error</html>', { headers: { 'content-type': 'text/html' } }));
		expect((await photo('gemini-key', { image, mediaType: 'image/jpeg' })).status).toBe(502);
		stub(() => Response.json({ candidates: 'not a list' }));
		expect((await photo('gemini-key', { image, mediaType: 'image/jpeg' })).status).toBe(502);
		stub(() => new Response('quota', { status: 429 }));
		expect((await photo('gemini-key', { image, mediaType: 'image/jpeg' })).status).toBe(502);
	});
});

const ramble = (geminiApiKey: string | null, body: unknown) =>
	handleAgent(
		new Request('http://api.test/api/food-database/ramble', {
			method: 'POST',
			headers: { authorization: `Bearer ${config.ownerToken}` },
			body: JSON.stringify(body),
		}),
		{ space, driver, ownerToken: config.ownerToken, geminiApiKey },
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
		copy: '',
		except: [],
		meal: '',
		time: '',
		day: null,
		options: false,
		said: '',
	};

	test('the model sees aliases, and its answer comes back with the phone ids, defaults filled in', async () => {
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
		const sent = await requests[0]!.json();
		const instructions: string = sent.systemInstruction.parts[0].text;
		expect(instructions).toContain(
			'- m1: breakfast, yesterday, Monday 2026-10-26: e1 Oats (0.5 cup); e2 Blueberries (50 g)',
		);
		expect(instructions).toContain('- u1 Coffee (1 mug)');
		expect(sent.contents[0].parts).toEqual([{ text: `Ramble: ${body.transcript}` }]);
		expect(requests[0]!.url).toContain(`/${RAMBLE_MODEL.model}:generateContent`);
		const [food, copy] = sent.generationConfig.responseJsonSchema.properties.items.items.anyOf;
		expect(food.properties.ref.enum).toEqual(['', 'e1', 'e2', 'u1']);
		expect(copy.properties.copy.enum).toEqual(['m1']);
		expect(copy.required).toEqual(['kind', 'copy', 'said']);
	});

	test('a copy of no meal, an except outside the copied meal, and a nameless food are dropped', async () => {
		stub(() =>
			geminiText(
				JSON.stringify({
					items: [
						{ kind: 'copy', name: '', copy: '' },
						{ kind: 'copy', name: '', copy: 'm1', except: ['u1'] },
						{ kind: 'food', name: ' ' },
					],
				}),
			),
		);
		expect(await (await ramble('gemini-key', body)).json()).toEqual({
			items: [{ ...item, kind: 'copy', name: '', ref: null, copy: 'meal-uuid', meal: 'breakfast' }],
		});
	});

	test('a ref to a logged entry that shares no word with the food is dropped, so the food is searched', async () => {
		stub(() =>
			geminiText(
				JSON.stringify({
					items: [
						{ kind: 'food', name: 'apple', ref: 'u1' },
						{ kind: 'food', name: 'black coffee', ref: 'u1' },
					],
				}),
			),
		);
		const { items } = await (await ramble('gemini-key', body)).json();
		expect(items.map((item: { name: string; ref: string | null }) => [item.name, item.ref])).toEqual([
			['apple', null],
			['black coffee', 'coffee-uuid'],
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

	test('no key is a 503 before calling Gemini, an empty transcript calls nothing, and a bad answer is a 502', async () => {
		stub(() => geminiText('not json'));
		expect((await ramble(null, body)).status).toBe(503);
		expect(await (await ramble('gemini-key', { ...body, transcript: '  ' })).json()).toEqual({ items: [] });
		expect(requests).toEqual([]);
		expect((await ramble('gemini-key', body)).status).toBe(502);
		expect((await ramble('gemini-key', { ...body, time: '8am' })).status).toBe(400);
	});
});
