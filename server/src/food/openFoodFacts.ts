import { z } from 'zod';
import { foodNutrition } from '../../../shared/db/schema';
import { ApiError } from '../agent/db';

/** Open Food Facts asks every client to name itself, and blocks anonymous scrapers. */
export const USER_AGENT = 'ABetterMe/1.0 (+https://github.com/smirea/a-better-me)';
export const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';
/** Search-a-licious: the product API's own search has no full-text query, and the legacy `cgi/search.pl` is retired. */
export const SEARCH_URL = 'https://search.openfoodfacts.org/search';
const FIELDS = [
	'code',
	'product_name',
	'brands',
	'nutriments',
	'serving_quantity',
	'serving_quantity_unit',
	'product_quantity_unit',
].join(',');
const TIMEOUT_MS = 8000;

/** The app's `Food` as JSON: the row a phone caches with `LocalStore.saveFood` under `off-<barcode>`. */
export const BrandedFood = z
	.object({
		id: z.string(),
		source: z.literal('open_food_facts'),
		name: z.string().min(1),
		brand: z.string().optional(),
		barcode: z.string(),
		nutrition: foodNutrition,
	})
	.meta({ id: 'BrandedFood' });
export type BrandedFood = z.output<typeof BrandedFood>;

/**
 * Open Food Facts nutriment keys to registry ids. Its `<key>_100g` values are per 100 g or 100 mL in grams (kcal for
 * energy, percent by volume for alcohol), so `scale` converts grams to the registry's unit.
 */
const NUTRIMENTS: [key: string, id: string, scale: number][] = [
	['proteins', 'p', 1],
	['fat', 'f', 1],
	['carbohydrates', 'c', 1],
	['fiber', '291', 1],
	['sugars', '269', 1],
	['added-sugars', '539', 1],
	['starch', '209', 1],
	['saturated-fat', '606', 1],
	['monounsaturated-fat', '645', 1],
	['polyunsaturated-fat', '646', 1],
	['trans-fat', '693', 1],
	['omega-3-fat', '901', 1],
	['alpha-linolenic-acid', '851', 1],
	['eicosapentaenoic-acid', '629', 1],
	['docosahexaenoic-acid', '621', 1],
	['omega-6-fat', '902', 1],
	['cholesterol', '601', 1e3],
	['caffeine', '262', 1e3],
	['sodium', '307', 1e3],
	['vitamin-a', '320', 1e6],
	['vitamin-d', '328', 1e6],
	['vitamin-e', '323', 1e3],
	['vitamin-k', '430', 1e6],
	['vitamin-c', '401', 1e3],
	['vitamin-b1', '404', 1e3],
	['vitamin-b2', '405', 1e3],
	['vitamin-pp', '406', 1e3],
	['pantothenic-acid', '410', 1e3],
	['vitamin-b6', '415', 1e3],
	['vitamin-b9', '417', 1e6],
	['vitamin-b12', '418', 1e6],
	['choline', '421', 1e3],
	['calcium', '301', 1e3],
	['copper', '312', 1e3],
	['iron', '303', 1e3],
	['magnesium', '304', 1e3],
	['manganese', '315', 1e3],
	['phosphorus', '305', 1e3],
	['potassium', '306', 1e3],
	['selenium', '317', 1e6],
	['zinc', '309', 1e3],
];
const KJ_PER_KCAL = 4.184;
/** Sodium is 40% of salt by weight; many European labels give only salt. */
const SODIUM_PER_SALT = 0.4;
/** Grams of ethanol in a milliliter, to turn percent by volume into grams per 100 mL. */
const ETHANOL_DENSITY = 0.789;

type Product = {
	code?: string;
	product_name?: string;
	brands?: string | string[];
	nutriments?: Record<string, unknown>;
	serving_quantity?: number | string;
	serving_quantity_unit?: string;
	product_quantity_unit?: string;
};

/** Six significant digits are more than any label has, and they hide float noise from the unit conversions. */
const tidy = (value: number) => Number(value.toPrecision(6));

function nutrients(nutriments: Record<string, unknown>): Record<string, number> {
	const per100 = (key: string) => {
		const raw = nutriments[`${key}_100g`];
		const value = Number(raw);
		return raw !== undefined && raw !== null && raw !== '' && Number.isFinite(value) && value >= 0 ? value : undefined;
	};
	const amounts: Record<string, number> = {};
	const kj = per100('energy-kj') ?? per100('energy');
	const kcal = per100('energy-kcal') ?? (kj === undefined ? undefined : kj / KJ_PER_KCAL);
	if (kcal !== undefined) amounts.k = tidy(kcal);
	for (const [key, id, scale] of NUTRIMENTS) {
		const value = per100(key);
		if (value !== undefined) amounts[id] = tidy(value * scale);
	}
	const salt = per100('salt');
	if (amounts['307'] === undefined && salt !== undefined) amounts['307'] = tidy(salt * SODIUM_PER_SALT * 1e3);
	const alcohol = per100('alcohol');
	if (alcohol !== undefined) amounts['221'] = tidy(alcohol * ETHANOL_DENSITY);
	return amounts;
}

/**
 * A product as the app's food: nutrients per 100 g, or per 100 mL for a product sold by volume, and the label's
 * serving first when it has one, so a new entry defaults to one serving as MacroFactor's does. Null when the product
 * has no name or no energy, which the app could not log.
 */
export function normalize(product: Product): BrandedFood | null {
	const name = product.product_name?.trim();
	const barcode = product.code?.trim();
	const amounts = nutrients(product.nutriments ?? {});
	if (!name || !barcode || amounts.k === undefined) return null;
	const byVolume = [product.serving_quantity_unit, product.product_quantity_unit].some(
		unit => unit?.toLowerCase() === 'ml',
	);
	const serving = Number(product.serving_quantity);
	const brand = (Array.isArray(product.brands) ? product.brands : (product.brands?.split(',') ?? []))
		.map(text => text.trim())
		.find(Boolean);
	return {
		id: `off-${barcode}`,
		source: 'open_food_facts',
		name,
		...(brand && { brand }),
		barcode,
		nutrition: {
			nutrients: amounts,
			...(byVolume ? { baseMilliliters: 100 } : { baseGrams: 100 }),
			measures: [
				...(serving > 0 ? [{ name: 'serving', quantity: 1, servings: tidy(serving / 100) }] : []),
				{ name: byVolume ? 'mL' : 'g', quantity: 100, servings: 1 },
			],
		},
	};
}

async function get(url: URL): Promise<Response> {
	try {
		return await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
	} catch {
		throw new ApiError(502, 'Open Food Facts did not answer');
	}
}

/** Null when Open Food Facts does not know the barcode. */
export async function lookupBarcode(barcode: string): Promise<BrandedFood | null> {
	const url = new URL(`${PRODUCT_URL}/${encodeURIComponent(barcode)}`);
	url.searchParams.set('fields', FIELDS);
	const response = await get(url);
	if (response.status === 404) return null;
	if (!response.ok) throw new ApiError(502, `Open Food Facts answered ${response.status}`);
	const body = (await response.json()) as { status?: number; product?: Product };
	if (body.status !== 1 || !body.product) return null;
	return normalize({ ...body.product, code: body.product.code ?? barcode });
}

export async function searchProducts(query: string, limit: number): Promise<BrandedFood[]> {
	const url = new URL(SEARCH_URL);
	url.searchParams.set('q', query);
	url.searchParams.set('page_size', String(limit));
	url.searchParams.set('fields', FIELDS);
	const response = await get(url);
	if (!response.ok) throw new ApiError(502, `Open Food Facts answered ${response.status}`);
	const { hits = [] } = (await response.json()) as { hits?: Product[] };
	return hits.flatMap(product => normalize(product) ?? []);
}
