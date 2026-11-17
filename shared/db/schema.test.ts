import { expect, test } from 'bun:test';
import { foodSnapshot, ingredientAlteration, nutrientAmounts, serving } from './schema';

/** What `RowJSON` writes for these values; `NutritionModelTests` asserts the same text on the Swift side. */
const yogurt =
	'{"foodID":"usda-171304","name":"Yogurt","nutrition":{"baseGrams":100,"measures":[{"name":"container","quantity":1,"servings":1.5}],"nutrients":{"291":2,"c":12,"f":4,"k":120,"p":10}},"source":"usda"}';
const container = '{"measure":{"name":"container","quantity":1,"servings":1.5},"quantity":1}';

test('the validators accept the nutrition JSON the app encodes', () => {
	expect(foodSnapshot.safeParse(JSON.parse(yogurt)).success).toBe(true);
	expect(serving.safeParse(JSON.parse(container)).success).toBe(true);
	const id = '"id":"5D4F2C1A-0000-4000-8000-000000000001"';
	for (const line of [
		`{"food":${yogurt},${id},"original":${container},"serving":${container}}`,
		`{"food":${yogurt},${id},"original":${container}}`,
		`{"food":${yogurt},${id},"serving":${container}}`,
	]) {
		expect(ingredientAlteration.safeParse(JSON.parse(line)).success).toBe(true);
	}
});

test('an alteration keeps what the recipe held or what was eaten', () => {
	expect(ingredientAlteration.safeParse({ id: 'a', food: JSON.parse(yogurt) }).success).toBe(false);
});

test('the validators refuse the column defaults and trees the app cannot decode', () => {
	expect(foodSnapshot.safeParse({}).success).toBe(false);
	expect(serving.safeParse({}).success).toBe(false);
	expect(serving.safeParse({ measure: { name: 'g', quantity: 0, servings: 1 }, quantity: 1 }).success).toBe(false);
	expect(nutrientAmounts.safeParse({ k: -1 }).success).toBe(false);
	expect(nutrientAmounts.safeParse({ energy: 100 }).success).toBe(false);
});
