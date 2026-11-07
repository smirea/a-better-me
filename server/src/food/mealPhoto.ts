import { z } from 'zod';
import { generateJson } from './gemini';

/**
 * Gemini Flash measured best at naming foods and weighing portions from meal photos in 2026's independent benchmarks
 * (docs/decisions/nutrition.md). Pinned rather than `gemini-flash-latest`, so a model change is a reviewed diff.
 */
export const GEMINI_MODEL = 'gemini-3.8-flash';
const TIMEOUT_MS = 30_000;

export const MealPhotoRequest = z.object({
	image: z.base64().min(1).max(8_000_000),
	mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
	note: z.string().trim().max(500).optional(),
});

/** One food the model sees. Grams only: the phone matches `search` against its own foods and does the nutrition. */
const MealPhotoItem = z
	.object({
		name: z.string().min(1),
		search: z.string().min(1),
		grams: z.number().min(0),
		confidence: z.number().min(0).max(1),
	})
	.meta({ id: 'MealPhotoItem' });

export const MealPhoto = z.object({ items: z.array(MealPhotoItem) }).meta({ id: 'MealPhoto' });
export type MealPhoto = z.output<typeof MealPhoto>;

const PROMPT = `You log meals for a calorie tracker. List every food and drink in the photo that the person is about to eat.

- One item per separately weighable food: split a plate into its components (rice, chicken, broccoli), but keep a single dish whole when its parts cannot be told apart (lasagna, a smoothie, soup).
- Include what is cooked in or poured on when you can see or reasonably infer it: oil, butter, dressing, sauce, cheese, sugar in a drink. Give it its own item.
- "name" is what a person would call it ("Grilled chicken breast"). "search" is the closest food description in USDA's SR Legacy database, in its comma style, for the food as served: "Chicken, broilers or fryers, breast, meat only, cooked, roasted", "Rice, white, long-grain, regular, enriched, cooked", "Broccoli, cooked, boiled, drained, without salt", "Oil, olive, salad or cooking". Prefer a common SR Legacy food over a branded or restaurant one.
- "grams" is the edible weight in the photo. Use the plate, cutlery, hands, and packaging for scale. A scale's display or a label's weight overrides your estimate.
- "confidence" is 0 to 1 for the identification and the weight together.
- If the note contradicts the photo, the note wins. If there is no food, return no items.`;

/** The `responseSchema` subset Gemini accepts (OpenAPI 3.0), not JSON Schema. */
const RESPONSE_SCHEMA = {
	type: 'OBJECT',
	properties: {
		items: {
			type: 'ARRAY',
			items: {
				type: 'OBJECT',
				properties: {
					name: { type: 'STRING' },
					search: { type: 'STRING' },
					grams: { type: 'NUMBER' },
					confidence: { type: 'NUMBER' },
				},
				required: ['name', 'search', 'grams', 'confidence'],
				propertyOrdering: ['name', 'search', 'grams', 'confidence'],
			},
		},
	},
	required: ['items'],
};

export async function recognizeMeal(request: z.output<typeof MealPhotoRequest>, apiKey: string): Promise<MealPhoto> {
	const note = request.note ? `\n\nThe person's note: ${request.note}` : '';
	const meal = await generateJson(
		GEMINI_MODEL,
		{
			contents: [
				{
					role: 'user',
					parts: [{ inline_data: { mime_type: request.mediaType, data: request.image } }, { text: PROMPT + note }],
				},
			],
			generationConfig: {
				responseMimeType: 'application/json',
				responseSchema: RESPONSE_SCHEMA,
				// The default level took 12 s on a plate photo and low 3 s with the same foods; the logger waits on it.
				thinkingConfig: { thinkingLevel: 'low' },
			},
		},
		MealPhoto,
		{ apiKey, signal: AbortSignal.timeout(TIMEOUT_MS) },
	);
	return { items: meal.items.filter(item => item.grams > 0) };
}
