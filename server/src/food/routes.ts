import { z } from 'zod';
import { ApiError } from '../agent/db';
import { limit, route, type Route } from '../agent/route';
import { MealPhoto, MealPhotoRequest, recognizeMeal } from './mealPhoto';
import { outlineRamble, RambleOutline, RambleRequest } from './ramble';
import { BrandedFood, lookupBarcode, searchProducts } from './openFoodFacts';

/**
 * Branded foods for the app's food search, proxied from Open Food Facts so the phone holds no third-party client and
 * the mapping to registry nutrient ids lives in one place. Photo logging goes through here too, so the Gemini key
 * never leaves the server. Nothing is cached here: the phone caches what the owner
 * logs (`LocalStore.saveFood`), and a lookup is one request.
 */
export const foodRoutes: Route[] = [
	route({
		method: 'GET',
		path: '/food-database/barcode/{barcode}',
		tag: 'Food database',
		summary: 'Look up a branded food by barcode',
		description:
			"Open Food Facts product data as the app's food: nutrients per 100 g (or 100 mL) under registry ids, the label serving first. 404 when the barcode is unknown or the product has no energy.",
		response: BrandedFood,
		async run({ params }) {
			const barcode = params.barcode!;
			if (!/^\d{6,14}$/.test(barcode)) throw new ApiError(400, 'A barcode is 6 to 14 digits');
			const food = await lookupBarcode(barcode);
			if (!food) throw new ApiError(404, `Open Food Facts has no usable product ${barcode}`);
			return food;
		},
	}),
	route({
		method: 'GET',
		path: '/food-database/search',
		tag: 'Food database',
		summary: 'Search branded foods by name',
		description: 'Open Food Facts products matching `q`, in its relevance order, without the ones that have no energy.',
		query: z.object({ q: z.string().trim().min(2), limit: limit(20, 50) }),
		response: z.array(BrandedFood),
		run: ({ query }) => searchProducts(query.q, query.limit),
	}),
	route({
		method: 'POST',
		path: '/food-database/photo',
		tag: 'Food database',
		summary: 'Name the foods in a meal photo',
		description:
			'Gemini lists each food it sees with its edible weight in grams and a generic `search` name; it never estimates nutrition. Match `search` against a food database and scale its nutrients by `grams`. `note` corrects what the photo cannot show. 503 when the server has no Gemini key.',
		body: MealPhotoRequest,
		response: MealPhoto,
		run({ body, geminiApiKey }) {
			if (!geminiApiKey) throw new ApiError(503, 'Photo logging needs GEMINI_API_KEY on the server');
			return recognizeMeal(body, geminiApiKey);
		},
	}),
	route({
		method: 'POST',
		path: '/food-database/ramble',
		tag: 'Food database',
		summary: 'Turn a spoken food ramble into log items',
		description:
			"Gemini reads the whole transcript so far and returns every item after the speaker's corrections, in spoken order: a `food` to search for by `name` (or reuse a logged entry by `ref`), or a `copy` of a logged meal minus `except`. The phone sends the recent meals and usual foods the speaker can point back at, and the options it shows per item. Send the full transcript each time; the answer replaces the last one. 503 when the server has no Gemini key.",
		body: RambleRequest,
		response: RambleOutline,
		run({ body, geminiApiKey }) {
			if (!geminiApiKey) throw new ApiError(503, 'Ramble logging needs GEMINI_API_KEY on the server');
			return outlineRamble(body, geminiApiKey);
		},
	}),
];
