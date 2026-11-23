import { expect, test } from 'bun:test';
import { foodSnapshot, ingredientAlteration, nutrientAmounts, serving, supplementRegimen } from './schema';

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

test('a supplement regimen is accepted as the app encodes it, open or ended, daily or on ISO weekdays, paused or not', () => {
	/** What `RowJSON` wrote for these regimens on a device, read from its `supplements.regimens` column. */
	for (const regimen of [
		'{"count":1,"start":"2026-11-17","weekdays":[2,3,4,5,6,7]}',
		'{"count":1,"end":"2026-11-16","start":"2026-07-20","timing":"morning","weekdays":[]}',
		'{"count":6,"pauses":[{"end":"2026-11-29","start":"2026-11-23"},{"start":"2026-12-07"}],"start":"2026-11-16","weekdays":[1]}',
	]) {
		expect(supplementRegimen.safeParse(JSON.parse(regimen)).success).toBe(true);
	}
	expect(supplementRegimen.safeParse({ count: 1, start: '2026-11-17', weekdays: [0] }).success).toBe(false);
	expect(supplementRegimen.safeParse({ count: 0, start: '2026-11-17', weekdays: [] }).success).toBe(false);
	expect(
		supplementRegimen.safeParse({ count: 1, start: '2026-11-17', weekdays: [], pauses: [{ end: '2026-11-20' }] })
			.success,
	).toBe(false);
});
