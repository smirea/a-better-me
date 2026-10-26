import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { foodNutrition } from '../../shared/db/schema';
import { DATASET, generatorHash, OUT } from './usda-foods';

const db = new Database(OUT, { readonly: true });
const meta = Object.fromEntries(
	db
		.query('SELECT key, value FROM meta')
		.all()
		.map(row => [(row as { key: string }).key, (row as { value: string }).value]),
);

test('the bundled USDA foods match the generator and its pinned dataset', () => {
	expect(
		{ version: meta.version, sha256: meta.sha256, generator: meta.generator },
		'usda-foods.sqlite is stale. Run bun app-ios/scripts/usda-foods.ts.',
	).toEqual({ version: DATASET.version, sha256: DATASET.sha256, generator: generatorHash() });
});

test('every row decodes as the app decodes FoodNutrition', () => {
	const rows = db.query('SELECT fdc_id, name, nutrition FROM foods').all() as {
		fdc_id: number;
		name: string;
		nutrition: string;
	}[];
	expect(rows.length).toBe(Number(meta.foods));
	const invalid = rows.filter(row => !foodNutrition.safeParse(JSON.parse(row.nutrition)).success);
	expect(invalid.map(row => row.name)).toEqual([]);
	const banana = rows.find(row => row.fdc_id === 173944)!;
	expect(banana.name).toBe('Bananas, raw');
	expect(JSON.parse(banana.nutrition).measures[0]).toEqual({
		name: 'medium (7" to 7-7/8" long)',
		quantity: 1,
		servings: 1.18,
	});
});
