import { z } from 'zod';
import { foodNutrition } from '../../../shared/db/schema';
import { generateJson } from './gemini';
import { GEMINI_MODEL } from './mealPhoto';

const TIMEOUT_MS = 45_000;

const LabelImage = z.object({
	image: z.base64().min(1).max(8_000_000),
	mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
});

export const FoodLabelRequest = z.object({ images: z.array(LabelImage).min(1).max(8) });

/** What the photos say about one food. A field the photos don't show is left out, so the phone keeps what it has. */
export const FoodLabel = z
	.object({
		name: z.string().min(1).optional(),
		brand: z.string().min(1).optional(),
		store: z.string().min(1).optional(),
		nutrition: foodNutrition.optional(),
	})
	.meta({ id: 'FoodLabel' });
export type FoodLabel = z.output<typeof FoodLabel>;

/** The label's nutrients, named with the unit the model reports them in, which is the registry id's unit. */
const NUTRIENTS: [key: string, id: string][] = [
	['calories_kcal', 'k'],
	['protein_g', 'p'],
	['total_fat_g', 'f'],
	['total_carbohydrate_g', 'c'],
	['dietary_fiber_g', '291'],
	['total_sugars_g', '269'],
	['added_sugars_g', '539'],
	['saturated_fat_g', '606'],
	['trans_fat_g', '693'],
	['monounsaturated_fat_g', '645'],
	['polyunsaturated_fat_g', '646'],
	['cholesterol_mg', '601'],
	['sodium_mg', '307'],
	['potassium_mg', '306'],
	['calcium_mg', '301'],
	['iron_mg', '303'],
	['magnesium_mg', '304'],
	['phosphorus_mg', '305'],
	['zinc_mg', '309'],
	['vitamin_a_mcg', '320'],
	['vitamin_c_mg', '401'],
	['vitamin_d_mcg', '328'],
	['vitamin_e_mg', '323'],
	['vitamin_k_mcg', '430'],
	['thiamin_mg', '404'],
	['riboflavin_mg', '405'],
	['niacin_mg', '406'],
	['vitamin_b6_mg', '415'],
	['folate_mcg', '417'],
	['vitamin_b12_mcg', '418'],
	['caffeine_mg', '262'],
];

const amount = z.number().min(0).nullish();
const ModelLabel = z.object({
	name: z.string().nullish(),
	brand: z.string().nullish(),
	store: z.string().nullish(),
	serving: z
		.object({
			quantity: z.number().positive(),
			unit: z.string().min(1),
			grams: z.number().positive().nullish(),
			milliliters: z.number().positive().nullish(),
		})
		.nullish(),
	servingsPerContainer: z.number().positive().nullish(),
	nutrients: z.object(Object.fromEntries(NUTRIENTS.map(([key]) => [key, amount]))).nullish(),
});
type ModelLabel = z.output<typeof ModelLabel>;

const PROMPT = `You read food packaging for a calorie tracker. The photos all show one food: its front, its nutrition facts panel, a store's price label, or other sides. Combine what they show into one answer.

- "name" is the product's name as a person would call it ("Chicken Tikka Masala", "Greek Yogurt, Plain"), without the brand. If no photo names it, describe the food from its ingredients or what it looks like, in at most five words.
- "brand" is the brand printed on the package. A store's own prepared food (a deli or bakery label packed for the store) has the store as its brand.
- "store" is the store the label says the food was packed for or sold at ("Packed for Whole Foods Market"), as its everyday name ("Whole Foods Market"). Null for a manufacturer's package that names no store.
- "serving" is the serving the nutrition panel describes: its quantity and unit as printed ("1 ea", "2/3 cup", "1 bar", "100 g"; a per-100 g panel is quantity 100, unit "g"), and its weight in grams or volume in milliliters when the panel or the package gives it. When the package holds one serving and only the net weight is printed, the serving weighs the net weight.
- "servingsPerContainer" as printed; null when not printed.
- "nutrients" are the amounts per serving, in the unit each key names, read from the panel's amount column. Use a % Daily Value only for a nutrient that has no amount printed, converting with the FDA's 2020 Daily Values. Null for a nutrient the photos don't show.
- Leave everything null that no photo shows. Never guess nutrition for a food whose panel is not in the photos.`;

const nullable = (type: string) => ({ type, nullable: true });

/** The `responseSchema` subset Gemini accepts (OpenAPI 3.0), not JSON Schema. */
const RESPONSE_SCHEMA = {
	type: 'OBJECT',
	properties: {
		name: { type: 'STRING' },
		brand: nullable('STRING'),
		store: nullable('STRING'),
		serving: {
			type: 'OBJECT',
			nullable: true,
			properties: {
				quantity: { type: 'NUMBER' },
				unit: { type: 'STRING' },
				grams: nullable('NUMBER'),
				milliliters: nullable('NUMBER'),
			},
			required: ['quantity', 'unit'],
			propertyOrdering: ['quantity', 'unit', 'grams', 'milliliters'],
		},
		servingsPerContainer: nullable('NUMBER'),
		nutrients: {
			type: 'OBJECT',
			nullable: true,
			properties: Object.fromEntries(NUTRIENTS.map(([key]) => [key, nullable('NUMBER')])),
			propertyOrdering: NUTRIENTS.map(([key]) => key),
		},
	},
	// Required because Gemini once left the name out of a label it read everything else from.
	required: ['name'],
	propertyOrdering: ['name', 'brand', 'store', 'serving', 'servingsPerContainer', 'nutrients'],
};

const text = (value: string | null | undefined) => value?.trim() || undefined;
const tidy = (value: number) => Number(value.toPrecision(6));

/**
 * The app's `FoodNutrition` for the panel: the printed serving is the base serving, and a package of more than one
 * serving adds "container". No energy means no panel was read, so there is no nutrition.
 */
function nutrition(label: ModelLabel): FoodLabel['nutrition'] {
	const amounts: Record<string, number> = {};
	for (const [key, id] of NUTRIENTS) {
		const value = label.nutrients?.[key];
		if (value !== null && value !== undefined) amounts[id] = tidy(value);
	}
	if (amounts.k === undefined) return undefined;
	const serving = label.serving;
	const measures = [{ name: serving?.unit.trim() || 'serving', quantity: serving?.quantity ?? 1, servings: 1 }];
	const perContainer = label.servingsPerContainer;
	if (perContainer && perContainer > 1) measures.push({ name: 'container', quantity: 1, servings: tidy(perContainer) });
	return {
		nutrients: amounts,
		...(serving?.grams
			? { baseGrams: tidy(serving.grams) }
			: serving?.milliliters
				? { baseMilliliters: tidy(serving.milliliters) }
				: {}),
		measures,
	};
}

export async function readFoodLabel(request: z.output<typeof FoodLabelRequest>, apiKey: string): Promise<FoodLabel> {
	const label = await generateJson(
		GEMINI_MODEL,
		{
			contents: [
				{
					role: 'user',
					parts: [
						...request.images.map(image => ({ inline_data: { mime_type: image.mediaType, data: image.image } })),
						{ text: PROMPT },
					],
				},
			],
			generationConfig: {
				responseMimeType: 'application/json',
				responseSchema: RESPONSE_SCHEMA,
				thinkingConfig: { thinkingLevel: 'low' },
			},
		},
		ModelLabel,
		{ apiKey, signal: AbortSignal.timeout(TIMEOUT_MS) },
	);
	const result: FoodLabel = {};
	const name = text(label.name);
	const brand = text(label.brand);
	const store = text(label.store);
	const facts = nutrition(label);
	if (name) result.name = name;
	if (brand) result.brand = brand;
	if (store) result.store = store;
	if (facts) result.nutrition = facts;
	return result;
}
