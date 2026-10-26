import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { generate } from 'sync-engine/schema';
import { SWIFT_SCHEMA } from '../../scripts/generate';
import { foodSnapshot, nutrientAmounts, schema, serving } from './schema';

const root = join(import.meta.dir, '../..');

test('the committed Swift schema is what `bun run generate` writes', () => {
	const committed = readFileSync(join(root, SWIFT_SCHEMA), 'utf8');
	expect(committed).toBe(generate({ schema }).swift);
});

describe('nutrition validators', () => {
	/** What `RowJSON` writes for these values; `NutritionModelTests` asserts the same text on the Swift side. */
	const yogurt =
		'{"foodID":"usda-171304","name":"Yogurt","nutrition":{"baseGrams":100,"measures":[{"name":"container","quantity":1,"servings":1.5}],"nutrients":{"291":2,"c":12,"f":4,"k":120,"p":10}},"source":"usda"}';
	const container = '{"measure":{"name":"container","quantity":1,"servings":1.5},"quantity":1}';

	test('accept what the app encodes', () => {
		expect(foodSnapshot.safeParse(JSON.parse(yogurt)).success).toBe(true);
		expect(serving.safeParse(JSON.parse(container)).success).toBe(true);
	});

	test('refuse the column defaults and trees the app cannot decode', () => {
		expect(foodSnapshot.safeParse({}).success).toBe(false);
		expect(serving.safeParse({}).success).toBe(false);
		expect(serving.safeParse({ measure: { name: 'g', quantity: 0, servings: 1 }, quantity: 1 }).success).toBe(false);
		expect(nutrientAmounts.safeParse({ k: -1 }).success).toBe(false);
		expect(nutrientAmounts.safeParse({ energy: 100 }).success).toBe(false);
	});
});

test('the nutrient registry has every MacroFactor nutrient, with its unit, under an id the validators accept', () => {
	const registry: { id: string; unit: string }[] = JSON.parse(
		readFileSync(join(root, 'app-ios/Sources/App/Resources/Nutrition/nutrients.json'), 'utf8'),
	);
	const research = readFileSync(join(root, 'docs/research/macrofactor/nutrients.md'), 'utf8')
		.split('<!-- generated:nutrients:start -->')[1]!
		.split('<!-- generated:nutrients:end -->')[0]!;
	const units = Object.fromEntries(
		[...research.matchAll(/^\| `([^`]+)` +\|(?:[^|]*\|){4} *([^ |]+) *\|/gm)].map(([, id, unit]) => [id!, unit!]),
	);
	expect(Object.keys(units)).toHaveLength(56);
	expect(Object.fromEntries(registry.map(({ id, unit }) => [id, unit]))).toEqual(units);
	expect(nutrientAmounts.safeParse(Object.fromEntries(registry.map(({ id }) => [id, 1]))).success).toBe(true);
});
