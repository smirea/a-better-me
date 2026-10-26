#!/usr/bin/env bun
/**
 * Regenerates the bundled USDA generic foods, `Sources/App/Resources/Nutrition/usda-foods.sqlite`:
 * `bun app-ios/scripts/usda-foods.ts`. It downloads the pinned FoodData Central release once into `.cache/usda/`,
 * checks its sha256, and writes a read-only SQLite file the app's `FoodSearch` opens. Each row holds a food's name, a
 * ranking prior, and its `FoodNutrition` JSON exactly as Swift decodes it, so a search reads names into memory and
 * decodes nutrition only for the rows it shows. `usda-foods.test.ts` fails when the file is older than this script.
 */
import { $ } from 'bun';
import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const DATASET = {
	name: 'FoodData Central SR Legacy',
	version: '2018-04',
	url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip',
	sha256: 'b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0',
};

export const OUT = resolve(import.meta.dir, '../Sources/App/Resources/Nutrition/usda-foods.sqlite');
const REGISTRY = resolve(import.meta.dir, '../Sources/App/Resources/Nutrition/nutrients.json');
const CACHE = resolve(import.meta.dir, '../../.cache/usda');

/** The script's own text: any change to the mapping, the staples, or the priors makes the bundled file stale. */
export const generatorHash = () =>
	createHash('sha256')
		.update(readFileSync(import.meta.path))
		.digest('hex');

/** Infant foods and the regional Alaska Native foods only crowd an adult's search. */
const DROPPED_CATEGORIES = new Set(['Baby Foods', 'American Indian/Alaska Native Foods']);

/** Prepared dishes rank below the plain foods they share words with. */
const CATEGORY_PRIOR: Record<string, number> = {
	'Fast Foods': -3,
	'Restaurant Foods': -3,
	'Meals, Entrees, and Side Dishes': -2,
};

/**
 * MacroFactor's Common tab is a curated set; ours is these SR Legacy descriptions, the entry an owner typing the
 * plain name expects first ("banana", "egg", "chicken breast", "rice cooked"). The generator fails on a description
 * the dataset lacks.
 */
const STAPLES = [
	'Bananas, raw',
	'Apples, raw, with skin',
	'Oranges, raw, all commercial varieties',
	'Strawberries, raw',
	'Blueberries, raw',
	'Grapes, red or green (European type, such as Thompson seedless), raw',
	'Avocados, raw, all commercial varieties',
	'Pineapple, raw, all varieties',
	'Mangos, raw',
	'Raspberries, raw',
	'Lemons, raw, without peel',
	'Watermelon, raw',
	'Peaches, yellow, raw',
	'Pears, raw',
	'Egg, whole, raw, fresh',
	'Milk, whole, 3.25% milkfat, with added vitamin D',
	'Yogurt, Greek, plain, nonfat',
	'Yogurt, plain, whole milk',
	'Cheese, cheddar',
	'Butter, salted',
	'Chicken, broilers or fryers, breast, meat only, cooked, roasted',
	'Chicken, broilers or fryers, thigh, meat only, cooked, roasted',
	'Turkey, whole, breast, meat only, cooked, roasted',
	'Beef, ground, 85% lean meat / 15% fat, patty, cooked, broiled',
	'Pork, fresh, loin, tenderloin, separable lean only, cooked, roasted',
	'Pork, cured, bacon, cooked, baked',
	'Fish, salmon, Atlantic, farmed, cooked, dry heat',
	'Fish, tuna, light, canned in water, drained solids',
	'Fish, cod, Atlantic, cooked, dry heat',
	'Crustaceans, shrimp, cooked',
	'Rice, white, long-grain, regular, enriched, cooked',
	'Pasta, cooked, enriched, without added salt',
	'Cereals, oats, regular and quick, not fortified, dry',
	'Bread, whole-wheat, commercially prepared',
	'Potatoes, baked, flesh and skin, without salt',
	'Sweet potato, cooked, baked in skin, flesh, without salt',
	'Broccoli, raw',
	'Spinach, raw',
	'Carrots, raw',
	'Tomatoes, red, ripe, raw, year round average',
	'Onions, raw',
	'Cucumber, with peel, raw',
	'Lettuce, cos or romaine, raw',
	'Peppers, sweet, red, raw',
	'Mushrooms, white, raw',
	'Corn, sweet, yellow, raw',
	'Beans, black, mature seeds, cooked, boiled, without salt',
	'Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt',
	'Lentils, mature seeds, cooked, boiled, without salt',
	'Tofu, raw, firm, prepared with calcium sulfate',
	'Nuts, almonds',
	'Nuts, walnuts, english',
	'Peanut butter, smooth style, without salt',
	'Oil, olive, salad or cooking',
	'Sugars, granulated',
	'Honey',
	'Beverages, coffee, brewed, prepared with tap water',
	'Beverages, tea, black, brewed, prepared with tap water',
	'Water, bottled, generic',
];
/** Common foods that are not the first answer to their name: egg whites, raw chicken, brown rice. */
const ALTERNATES = [
	'Egg, white, raw, fresh',
	'Egg, whole, cooked, hard-boiled',
	'Egg, whole, cooked, scrambled',
	'Egg, whole, cooked, fried',
	'Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D',
	'Cheese, mozzarella, whole milk',
	'Cheese, parmesan, grated',
	'Cheese, cottage, lowfat, 2% milkfat',
	'Cheese, cream',
	'Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw',
	'Chicken, broilers or fryers, dark meat, thigh, meat only, raw',
	'Beef, ground, 85% lean meat / 15% fat, raw',
	'Fish, salmon, Atlantic, farmed, raw',
	'Rice, white, long-grain, regular, raw, enriched',
	'Rice, brown, long-grain, cooked',
	'Pasta, dry, enriched',
	'Bread, white, commercially prepared (includes soft bread crumbs)',
	'Potatoes, flesh and skin, raw',
];
const STAPLE_PRIOR = 8;
const ALTERNATE_PRIOR = 5;
/** A note on 57 SR Legacy names that says nothing about the food. */
const NOISE = " (Includes foods for USDA's Food Distribution Program)";
/** A brand or chain in capitals ("KELLOGG'S", "McDONALD'S"): branded products rank below generic ones. */
const BRAND = /\b[A-Z][A-Z'&.-]{2,}\b/;
const BRAND_PRIOR = -3;

/**
 * The USDA numbers a registry id reads, the first one a food reports winning. A USDA nutrient number is the registry's
 * id unless listed here: the macros have letters, SR Legacy reports total trans fat as 605 while the registry keeps
 * MacroFactor's 693, and most foods report only the undifferentiated 18:3 (619), which is almost all ALA, instead of
 * 851. The omega totals 901 and 902 are MacroFactor's own ids, summed from the fatty acids SR Legacy lists, with the
 * undifferentiated isomers standing in where the n-3 or n-6 form is missing.
 */
const SOURCES: Record<string, string[]> = {
	k: ['208'],
	p: ['203'],
	f: ['204'],
	c: ['205'],
	'693': ['605', '693'],
	'851': ['851', '619'],
};
const sources = (id: string) => SOURCES[id] ?? [id];
const SUMS: Record<string, string[][]> = {
	'901': [['851', '619'], ['629'], ['631'], ['621']],
	'902': [['675', '618'], ['853', '620'], ['685'], ['672']],
};
/** The registry stores water in mL; USDA in grams, which is the same amount. */
const UNITS: Record<string, string> = { KCAL: 'kcal', G: 'g', MG: 'mg', UG: 'mcg' };
const WATER = '255';
/** Weights the app derives from the base serving's grams (`FoodNutrition.allMeasures`). */
const DERIVED_MEASURES = new Set(['g', 'oz', 'lb']);
/** The default serving, in order: MacroFactor's "1 medium" banana, then a large, then the label's serving. */
const DEFAULT_MEASURES = [/^medium\b/, /^large\b/, /\bserving\b/];

type Measure = { name: string; quantity: number; servings: number };
type Row = Record<string, string>;

/** FoodData Central's CSVs quote every field and escape a quote by doubling it. */
function parseCsv(text: string): Row[] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	const endField = () => {
		row.push(field);
		field = '';
	};
	for (let index = 0; index < text.length; index++) {
		const char = text[index]!;
		if (quoted) {
			if (char !== '"') field += char;
			else if (text[index + 1] === '"') field += text[index++];
			else quoted = false;
		} else if (char === '"') quoted = true;
		else if (char === ',') endField();
		else if (char === '\n') {
			endField();
			rows.push(row);
			row = [];
		} else if (char !== '\r') field += char;
	}
	if (field || row.length) {
		endField();
		rows.push(row);
	}
	const [header, ...body] = rows;
	return body.map(values => Object.fromEntries(header!.map((name, index) => [name, values[index] ?? ''])));
}

async function download(): Promise<string> {
	mkdirSync(CACHE, { recursive: true });
	const zip = join(CACHE, `sr-legacy-${DATASET.version}.zip`);
	if (!existsSync(zip)) {
		console.log(`Downloading ${DATASET.url}`);
		const response = await fetch(DATASET.url);
		if (!response.ok) throw new Error(`${DATASET.url} answered ${response.status}`);
		await Bun.write(`${zip}.part`, response);
		renameSync(`${zip}.part`, zip);
	}
	const sha256 = createHash('sha256').update(readFileSync(zip)).digest('hex');
	if (sha256 !== DATASET.sha256) throw new Error(`${zip} has sha256 ${sha256}, expected ${DATASET.sha256}`);
	return zip;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

function measures(portions: Row[]): Measure[] {
	const seen = new Set<string>();
	const all: Measure[] = [];
	for (const portion of portions.toSorted((a, b) => Number(a.seq_num) - Number(b.seq_num))) {
		const name = (portion.modifier || portion.portion_description || '').trim();
		const grams = Number(portion.gram_weight);
		if (!name || !(grams > 0) || DERIVED_MEASURES.has(name.toLowerCase()) || seen.has(name)) continue;
		seen.add(name);
		all.push({ name, quantity: Number(portion.amount) || 1, servings: grams / 100 });
	}
	for (const pattern of DEFAULT_MEASURES) {
		const index = all.findIndex(measure => pattern.test(measure.name));
		if (index > 0) all.unshift(...all.splice(index, 1));
		if (index >= 0) break;
	}
	return all.length ? all : [{ name: 'g', quantity: 100, servings: 1 }];
}

async function generate() {
	const zip = await download();
	const folder = `FoodData_Central_sr_legacy_food_csv_${DATASET.version}`;
	const read = async (file: string) => parseCsv(await $`unzip -p ${zip} ${`${folder}/${file}`}`.text());
	const [foods, categories, nutrients, amounts, portions] = await Promise.all(
		['food.csv', 'food_category.csv', 'nutrient.csv', 'food_nutrient.csv', 'food_portion.csv'].map(read),
	);
	const registry: { id: string; unit: string }[] = await Bun.file(REGISTRY).json();

	const categoryName = new Map(categories!.map(row => [row.id!, row.description!]));
	const nutrientNumber = new Map(nutrients!.map(row => [row.id!, row]));
	const byFood = new Map<string, Map<string, number>>();
	for (const row of amounts!) {
		const nutrient = nutrientNumber.get(row.nutrient_id!);
		if (!nutrient || row.amount === '') continue;
		const values = byFood.get(row.fdc_id!) ?? new Map<string, number>();
		values.set(nutrient.nutrient_nbr!, Number(row.amount));
		byFood.set(row.fdc_id!, values);
	}
	const portionsByFood = Map.groupBy(portions!, row => row.fdc_id!);

	const unitOf = new Map([...nutrientNumber.values()].map(row => [row.nutrient_nbr!, row.unit_name!]));
	for (const { id, unit } of registry) {
		for (const number of [...sources(id), ...(SUMS[id]?.flat() ?? [])]) {
			const usda = unitOf.get(number);
			if (!usda) continue;
			const expected = number === WATER ? 'mL' : unit;
			if (number !== WATER && UNITS[usda] !== expected)
				throw new Error(`USDA ${number} is ${usda}, registry ${id} is ${unit}`);
		}
	}

	const missing = new Set([...STAPLES, ...ALTERNATES]);
	const rows = foods!
		.filter(food => !DROPPED_CATEGORIES.has(categoryName.get(food.food_category_id!) ?? ''))
		.toSorted((a, b) => Number(a.fdc_id) - Number(b.fdc_id))
		.map(food => {
			const values = byFood.get(food.fdc_id!) ?? new Map<string, number>();
			const nutrition: Record<string, number> = {};
			for (const { id } of registry) {
				const sum = SUMS[id];
				if (sum) {
					const parts = sum.map(options =>
						options.map(number => values.get(number)).find(value => value !== undefined),
					);
					if (parts.some(value => value !== undefined))
						nutrition[id] = round(parts.reduce((total, value) => total! + (value ?? 0), 0)!);
					continue;
				}
				const value = sources(id)
					.map(number => values.get(number))
					.find(amount => amount !== undefined);
				if (value !== undefined) nutrition[id] = value;
			}
			const name = food.description!.replace(NOISE, '');
			missing.delete(name);
			const prior =
				(STAPLES.includes(name) ? STAPLE_PRIOR : ALTERNATES.includes(name) ? ALTERNATE_PRIOR : 0) +
				(CATEGORY_PRIOR[categoryName.get(food.food_category_id!)!] ?? 0) +
				(BRAND.test(name) ? BRAND_PRIOR : 0);
			const json = JSON.stringify({
				nutrients: nutrition,
				baseGrams: 100,
				measures: measures(portionsByFood.get(food.fdc_id!) ?? []),
			});
			return [Number(food.fdc_id), name, prior, json] as const;
		});
	if (missing.size) throw new Error(`Staples missing from ${DATASET.name}: ${[...missing].join('; ')}`);

	const temporary = `${OUT}.tmp`;
	rmSync(temporary, { force: true });
	const db = new Database(temporary, { create: true });
	db.run('PRAGMA journal_mode = DELETE');
	db.run('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID');
	db.run(
		'CREATE TABLE foods (fdc_id INTEGER PRIMARY KEY, name TEXT NOT NULL, prior REAL NOT NULL, nutrition TEXT NOT NULL)',
	);
	const meta = db.prepare('INSERT INTO meta VALUES (?, ?)');
	const insert = db.prepare('INSERT INTO foods VALUES (?, ?, ?, ?)');
	db.transaction(() => {
		for (const [key, value] of Object.entries({
			dataset: DATASET.name,
			version: DATASET.version,
			sha256: DATASET.sha256,
			generator: generatorHash(),
			foods: String(rows.length),
		})) {
			meta.run(key, value);
		}
		for (const row of rows) insert.run(...row);
	})();
	db.run('VACUUM');
	db.close();
	renameSync(temporary, OUT);
	console.log(`Wrote ${rows.length} foods to ${OUT} (${(Bun.file(OUT).size / 1e6).toFixed(1)} MB)`);
}

if (import.meta.main) await generate();
