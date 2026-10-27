/**
 * Imports MacroFactor exports into A Better Me through the agent API:
 *
 *     bun scripts/import-macrofactor.ts --server <url> --token <token> <files...> [--dry-run]
 *
 * Takes any number of Granular Export and Quick Export `.xlsx` files. Every row gets an id derived from its source row,
 * so a second run, or a second file that overlaps the first, converges instead of duplicating. The mapping and what is
 * left out are in docs/decisions/nutrition.md, "Import".
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { readXlsx, type Cell, type Sheet } from './xlsx';

type Amounts = Record<string, number>;
type Measure = { name: string; quantity: number; servings: number };
type Serving = { measure: Measure; quantity: number };
type Nutrition = { nutrients: Amounts; baseGrams?: number; measures: Measure[] };
type Snapshot = { foodID?: string; source: 'custom' | 'recipe' | 'quick_add'; name: string; nutrition: Nutrition };
type Row = Record<string, unknown>;

/** MacroFactor's export columns, without their unit, to registry nutrient ids (docs/research/macrofactor/nutrients.md). */
export const NUTRIENT_COLUMNS: Record<string, string> = {
	Calories: 'k',
	Protein: 'p',
	Fat: 'f',
	Carbs: 'c',
	'Net (Non-fiber)': 'nc',
	Alcohol: '221',
	Caffeine: '262',
	Water: '255',
	Cholesterol: '601',
	Cysteine: '507',
	Histidine: '512',
	Isoleucine: '503',
	Leucine: '504',
	Lysine: '505',
	Methionine: '506',
	Phenylalanine: '508',
	Threonine: '502',
	Tryptophan: '501',
	Tyrosine: '509',
	Valine: '510',
	Fiber: '291',
	Starch: '209',
	Sugars: '269',
	'Sugars Added': '539',
	'Monounsaturated Fat': '645',
	'Polyunsaturated Fat': '646',
	'Saturated Fat': '606',
	'Trans Fat': '693',
	'Omega-3': '901',
	'Omega-3 ALA': '851',
	'Omega-3 EPA': '629',
	'Omega-3 DHA': '621',
	'Omega-6': '902',
	Folate: '417',
	'Vitamin A': '320',
	'B1, Thiamine': '404',
	'B2, Riboflavin': '405',
	'B3, Niacin': '406',
	'B5, Pantothenic Acid': '410',
	'B6, Pyridoxine': '415',
	'B12, Cobalamin': '418',
	'Vitamin C': '401',
	'Vitamin D': '328',
	'Vitamin E': '323',
	'Vitamin K': '430',
	Choline: '421',
	Calcium: '301',
	Copper: '312',
	Iron: '303',
	Magnesium: '304',
	Manganese: '315',
	Phosphorus: '305',
	Potassium: '306',
	Selenium: '317',
	Sodium: '307',
	Zinc: '309',
};

const KG_PER = { lb: 0.45359237, kg: 1 } as const;
const CM_PER = { in: 2.54, cm: 1 } as const;
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
/** Sheets the owner's export had empty, so their vocabulary is unknown. A filled one is reported, not guessed at. */
const UNSUPPORTED = ['Favorites', 'Food Log Notes', 'Micronutrient Goals'];
/** WeighIns.sameMomentTolerance: another weigh-in this close is the same one. */
const SAME_MOMENT_MS = 60_000;
/** The export has no time of day, so a weigh-in already stored that day at this weight is the same reading. */
const SAME_WEIGHT_KG = 0.05;

/** A UUID (version 8, RFC 9562) hashed from the source row, so importing the row again lands on the same id. */
export function stableId(...parts: (string | number)[]): string {
	const hex = new Bun.CryptoHasher('sha256').update(JSON.stringify(['macrofactor', ...parts])).digest('hex');
	const variant = ((Number.parseInt(hex[16]!, 16) & 3) | 8).toString(16);
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const splitUnit = (header: string) => {
	const match = /^(.*?) \(([^()]*)\)$/.exec(header);
	return match ? { name: match[1]!, unit: match[2]! } : { name: header, unit: '' };
};

/** One sheet's rows as objects keyed by header, empty cells left out ("not recorded", not zero). */
function records(sheet: Sheet | undefined): Record<string, Cell>[] {
	if (!sheet?.length) return [];
	const headers = sheet[0]!.map(cell => (cell === null ? '' : String(cell)));
	return sheet
		.slice(1)
		.filter(row => row.some(cell => cell !== null))
		.map(row =>
			Object.fromEntries(
				headers.flatMap((header, index) => ((row[index] ?? null) === null ? [] : [[header, row[index]!]])),
			),
		);
}

const number = (cell: Cell | undefined) => {
	const value = typeof cell === 'string' ? Number(cell.trim()) : cell;
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};
const text = (cell: Cell | undefined) =>
	cell === undefined || cell === null ? undefined : String(cell).trim() || undefined;

/** RFC 4180 CSV as a sheet: quoted fields may hold commas, `""`, and newlines; an empty field is null. */
export function parseCsv(source: string): Sheet {
	const rows: Sheet = [];
	let row: Cell[] = [];
	let field = '';
	let quoted = false;
	const body = source.replace(/^\uFEFF/, '');
	const endField = () => {
		row.push(field === '' ? null : field);
		field = '';
	};
	for (let index = 0; index < body.length; index++) {
		const char = body[index]!;
		if (quoted) {
			if (char === '"' && body[index + 1] === '"') {
				field += '"';
				index++;
			} else if (char === '"') quoted = false;
			else field += char;
		} else if (char === '"') quoted = true;
		else if (char === ',') endField();
		else if (char === '\n' || char === '\r') {
			if (char === '\r' && body[index + 1] === '\n') index++;
			endField();
			rows.push(row);
			row = [];
		} else field += char;
	}
	if (field !== '' || row.length) {
		endField();
		rows.push(row);
	}
	return rows;
}

/** An `.xlsx` export, or the CSV that Granular Export's "Export Food Log" writes, which holds the Food Log sheet alone. */
export function readExport(path: string): Map<string, Sheet> {
	if (path.toLowerCase().endsWith('.csv')) return new Map([['Food Log', parseCsv(readFileSync(path, 'utf8'))]]);
	return readXlsx(readFileSync(path));
}

/** Excel serials (days since 1899-12-30), `YYYY-MM-DD`, and `M/D/YYYY` text. */
export function toDay(cell: Cell | undefined): string {
	if (typeof cell === 'number')
		return new Date(Date.UTC(1899, 11, 30) + Math.floor(cell) * 86_400_000).toISOString().slice(0, 10);
	const value = text(cell) ?? '';
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
	if (us) return `${us[3]}-${us[1]!.padStart(2, '0')}-${us[2]!.padStart(2, '0')}`;
	throw new Error(`Not a date: ${JSON.stringify(cell)}`);
}

/** `02:48 PM`, `14:48`, or an Excel time fraction, as minutes since midnight. */
export function toMinute(cell: Cell | undefined): number {
	if (typeof cell === 'number') return Math.round((cell % 1) * 1440) % 1440;
	const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?$/i.exec(text(cell) ?? '');
	if (!match) throw new Error(`Not a time: ${JSON.stringify(cell)}`);
	const hour = Number(match[1]) % (match[3] ? 12 : 24);
	return (hour + (match[3]?.toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(match[2]);
}

function nutrients(record: Record<string, Cell>): Amounts {
	const amounts: Amounts = {};
	for (const [header, cell] of Object.entries(record)) {
		const id = NUTRIENT_COLUMNS[splitUnit(header).name];
		const value = number(cell);
		if (id && value !== undefined && value >= 0) amounts[id] = value;
	}
	return amounts;
}

/** The value of the column named `name`, converted from the unit its header names. */
function measured<Units extends Record<string, number>>(record: Record<string, Cell>, name: string, units: Units) {
	for (const [header, cell] of Object.entries(record)) {
		const { name: column, unit } = splitUnit(header);
		const value = number(cell);
		if (column !== name || value === undefined) continue;
		const factor = units[unit as keyof Units];
		if (factor === undefined) throw new Error(`${header}: unknown unit ${unit}`);
		return value * factor;
	}
	return undefined;
}

const scaled = (amounts: Amounts, factor: number) =>
	Object.fromEntries(Object.entries(amounts).map(([key, value]) => [key, value * factor]));
const netCarbs = (amounts: Amounts) =>
	amounts.nc ?? (amounts.c === undefined ? undefined : Math.max(0, amounts.c - (amounts['291'] ?? 0)));
/** `NutrientAmounts +`, as the app and the server sum. */
function add(left: Amounts, right: Amounts): Amounts {
	const sum = { ...left };
	for (const [key, value] of Object.entries(right)) sum[key] = (sum[key] ?? 0) + value;
	if (left.nc !== undefined || right.nc !== undefined) sum.nc = (netCarbs(left) ?? 0) + (netCarbs(right) ?? 0);
	return sum;
}
const servingsOf = (serving: Serving) => (serving.measure.servings * serving.quantity) / serving.measure.quantity;

/** Rows by the order they have in their file, numbered within equal keys, so exact duplicates stay distinct. */
function occurrences() {
	const seen = new Map<string, number>();
	return (key: string) => {
		const count = seen.get(key) ?? 0;
		seen.set(key, count + 1);
		return count;
	};
}

/**
 * A food the export describes per `quantity` of a named serving, as a base serving of one of that unit. The export's
 * Serving Weight is already one unit's weight (1 for `g`, 28.35 for `oz`, 4.4 for one large olive logged as 10), so it
 * is not divided by the quantity.
 */
function perUnit(amounts: Amounts, unit: string, quantity: number, grams: number | undefined): Nutrition {
	return {
		nutrients: scaled(amounts, 1 / quantity),
		...(grams && grams > 0 && { baseGrams: grams }),
		measures: [{ name: unit, quantity: 1, servings: 1 }],
	};
}

export type Parsed = {
	foods: Map<string, Row>;
	recipes: Map<string, Row>;
	entries: Map<string, Row>;
	weights: Map<string, Row>;
	metrics: Map<string, Row>;
	totals: Map<string, Amounts>;
	statuses: Map<string, 'partial' | 'fasted'>;
	plans: Map<string, Row>;
	profile: Row | undefined;
	skipped: Record<string, number>;
	warnings: string[];
};

/** What the export files hold, as the API rows they become. Nothing here talks to the server. */
export function parseExports(workbooks: Map<string, Sheet>[]): Parsed {
	const parsed: Parsed = {
		foods: new Map(),
		recipes: new Map(),
		entries: new Map(),
		weights: new Map(),
		metrics: new Map(),
		totals: new Map(),
		statuses: new Map(),
		plans: new Map(),
		profile: undefined,
		skipped: {},
		warnings: [],
	};
	const skip = (table: string) => (parsed.skipped[table] = (parsed.skipped[table] ?? 0) + 1);
	const customFoods = new Map<string, string>();
	/** Foods by lowercase name, for recipe ingredients: the custom foods, then every food the log names. */
	const known = new Map<string, Snapshot>();
	const recipeIds = new Map<string, string>();
	for (const name of workbooks.flatMap(sheets =>
		records(sheets.get('Recipes')).flatMap(r => text(r['Recipe Name']) ?? []),
	)) {
		if (!recipeIds.has(name.toLowerCase())) recipeIds.set(name.toLowerCase(), stableId('recipe', name, 0));
	}

	for (const sheets of workbooks) {
		const next = occurrences();
		for (const record of records(sheets.get('Custom Foods'))) {
			const name = text(record['Food Name']);
			if (!name) continue;
			const id = stableId('food', name, next(name));
			const quantity = number(record['Serving Qty']);
			const amounts = nutrients(record);
			if (recipeIds.has(name.toLowerCase()) || !quantity || quantity <= 0 || !Object.keys(amounts).length) {
				skip('foods');
				continue;
			}
			const unit = text(record['Serving Size']) ?? 'serving';
			const nutrition = perUnit(amounts, unit, quantity, measured(record, 'Serving Weight', { g: 1 }));
			parsed.foods.set(id, { id, source: 'custom', name, nutrition });
			customFoods.set(name.toLowerCase(), id);
			known.set(name.toLowerCase(), { foodID: id, source: 'custom', name, nutrition });
		}
	}

	for (const sheets of workbooks) {
		const next = occurrences();
		for (const record of records(sheets.get('Food Log'))) {
			const name = text(record['Food Name']);
			const quantity = number(record['Serving Qty']);
			if (!name || !quantity || quantity <= 0) {
				skip('food_entries');
				continue;
			}
			const day = toDay(record.Date);
			const minute = toMinute(record.Time);
			const unit = text(record['Serving Size']) ?? 'serving';
			const nutrition = perUnit(nutrients(record), unit, quantity, measured(record, 'Serving Weight', { g: 1 }));
			const key = JSON.stringify([day, minute, name, quantity]);
			const id = stableId('entry', day, minute, name, quantity, next(key));
			const library = customFoods.get(name.toLowerCase());
			const recipe = recipeIds.get(name.toLowerCase());
			const food: Snapshot = recipe
				? { foodID: recipe, source: 'recipe', name, nutrition }
				: library
					? { foodID: library, source: 'custom', name, nutrition }
					: { source: /^quick add$/i.test(name) ? 'quick_add' : 'custom', name, nutrition };
			parsed.entries.set(id, { id, day, minute, food, serving: { measure: nutrition.measures[0], quantity } });
			if (!library) known.set(name.toLowerCase(), food);
		}
	}

	for (const sheets of workbooks) {
		const next = occurrences();
		for (const record of records(sheets.get('Recipes'))) {
			const name = text(record['Recipe Name']);
			if (!name) continue;
			const id = stableId('recipe', name, next(name));
			parsed.recipes.set(id, recipeRow(id, name, record, known));
		}
	}

	for (const sheets of workbooks) {
		for (const record of records(sheets.get('Scale Weight'))) {
			const day = toDay(record.Date);
			const weightKg = measured(record, 'Weight', KG_PER);
			if (!weightKg) {
				skip('body_weights');
				continue;
			}
			const fat = number(record['Fat Percent']);
			const id = stableId('weight', day);
			parsed.weights.set(id, {
				id,
				weightKg,
				measuredAt: `${day}T12:00:00.000Z`,
				bodyFatPercent: fat !== undefined && fat >= 0 && fat <= 100 ? fat : null,
			});
		}

		for (const record of records(sheets.get('Body Metrics'))) {
			const day = toDay(record.Date);
			for (const [header, cell] of Object.entries(record)) {
				const { name, unit } = splitUnit(header);
				const value = number(cell);
				if (header === 'Date' || value === undefined) continue;
				const kind =
					name === 'Visual Body Fat Assessment' ? 'visual_body_fat' : name.toLowerCase().replaceAll(' ', '_');
				const factor = kind === 'visual_body_fat' ? 1 : CM_PER[unit as keyof typeof CM_PER];
				if (factor === undefined) throw new Error(`Body Metrics ${header}: unknown unit ${unit}`);
				parsed.metrics.set(`${day}/${kind}`, { value: value * factor });
			}
		}
		for (const record of records(sheets.get('Steps'))) {
			const steps = number(record.Steps);
			if (steps !== undefined && steps >= 0) parsed.metrics.set(`${toDay(record.Date)}/steps`, { value: steps });
		}

		for (const sheet of ['Calories & Macros', 'Micronutrients']) {
			for (const record of records(sheets.get(sheet))) {
				const day = toDay(record.Date);
				parsed.totals.set(day, { ...parsed.totals.get(day), ...nutrients(record) });
			}
		}
		for (const [sheet, status] of [
			['Partial Logging', 'partial'],
			['Fasting', 'fasted'],
		] as const) {
			for (const record of records(sheets.get(sheet))) {
				if (/^yes$/i.test(text(record[sheet]) ?? '')) parsed.statuses.set(toDay(record.Date), status);
			}
		}

		plans(sheets, parsed);

		const [profile] = records(sheets.get('User Profile'));
		if (profile) parsed.profile = profileOf(profile);

		for (const sheet of UNSUPPORTED) {
			const count = records(sheets.get(sheet)).length;
			if (count)
				parsed.warnings.push(`${sheet}: ${count} rows not imported (the importer does not read this sheet yet)`);
		}
	}
	for (const [day, amounts] of parsed.totals)
		if (!Object.values(amounts).some(value => value > 0)) parsed.totals.delete(day);
	return parsed;
}

/**
 * An ingredient the export lists as `Name (2 tbsp)`, resolved by name to an imported custom food or a food seen in the
 * food log when the unit is one that food can be measured in. Ingredients from MacroFactor's own database have no
 * nutrition in the export, so the recipe keeps them at zero and carries the rest of its exported totals in one more
 * ingredient: the recipe's nutrition stays exactly MacroFactor's.
 */
function recipeRow(id: string, name: string, record: Record<string, Cell>, known: Map<string, Snapshot>): Row {
	const ingredients: Row[] = [];
	let resolved: Amounts = {};
	let unresolved = 0;
	for (const [index, line] of (text(record.Ingredients) ?? '').split('\n').entries()) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const match = /^(.*) \(([\d.]+)\s*([^)]*)\)$/.exec(trimmed);
		const ingredient = match?.[1]?.trim() || trimmed;
		const quantity = Number(match?.[2]) || 1;
		const unit = match?.[3]?.trim() || 'serving';
		const food = known.get(ingredient.toLowerCase());
		const servings = food && unitServings(food.nutrition, unit);
		const ingredientId = stableId('ingredient', id, index);
		if (food && servings) {
			const serving = { measure: { name: unit, quantity: 1, servings }, quantity };
			ingredients.push({ id: ingredientId, food, serving });
			resolved = add(resolved, scaled(food.nutrition.nutrients, servingsOf(serving)));
		} else {
			const measure = { name: unit, quantity: 1, servings: 1 };
			ingredients.push({
				id: ingredientId,
				food: { source: 'custom', name: ingredient, nutrition: { nutrients: {}, measures: [measure] } },
				serving: { measure, quantity },
			});
			unresolved++;
		}
	}
	const totals = nutrients(record);
	const rest = Object.fromEntries(
		Object.entries(totals).flatMap(([key, value]) => {
			const left = value - ((key === 'nc' ? netCarbs(resolved) : resolved[key]) ?? 0);
			return left > 1e-6 ? [[key, left]] : [];
		}),
	);
	if (unresolved || (rest.k ?? 0) > 1) {
		const measure = { name: 'serving', quantity: 1, servings: 1 };
		ingredients.push({
			id: stableId('ingredient', id, 'rest'),
			food: {
				source: 'custom',
				name: 'Other ingredients (MacroFactor totals)',
				nutrition: { nutrients: rest, measures: [measure] },
			},
			serving: { measure, quantity: 1 },
		});
	}
	const servings = number(record['Serving Qty']);
	const minutes = (cell: Cell | undefined) => {
		const value = number(cell);
		return value !== undefined && value >= 0 ? Math.round(value) : null;
	};
	return {
		id,
		name,
		ingredients,
		servings: servings && servings > 0 ? servings : 1,
		cookedGrams: number(record['Total Weight (g)']) || null,
		steps: Object.keys(record)
			.filter(key => /^Step \d+$/.test(key))
			.toSorted((a, b) => Number(a.slice(5)) - Number(b.slice(5)))
			.flatMap(key => text(record[key]) ?? []),
		prepMinutes: minutes(record['Preparation Time (min)']),
		cookMinutes: minutes(record['Cooking Time (min)']),
		notes: text(record.Description) ?? '',
	};
}

/** Base servings in one `unit` of a food: one of its own measures, or grams and ounces from its base weight. */
function unitServings(nutrition: Nutrition, unit: string): number | undefined {
	const own = nutrition.measures.find(measure => measure.name.toLowerCase() === unit.toLowerCase());
	if (own) return own.servings / own.quantity;
	const grams = { g: 1, gram: 1, grams: 1, oz: 28.349523125 }[unit.toLowerCase()];
	return grams && nutrition.baseGrams ? grams / nutrition.baseGrams : undefined;
}

/**
 * Nutrition Program Settings is seven rows, one a weekday, per program update. Each update becomes a plan from its day,
 * under the weight goal in force then. The export does not say how the program was coached, so the program keeps the
 * app's defaults except the higher-calorie days, which show in the targets.
 */
function plans(sheets: Map<string, Sheet>, parsed: Parsed) {
	const goals = records(sheets.get('Weight Goals'))
		.map(record => {
			const label = text(record.Goal) ?? '';
			const kind = /loss|lose/i.test(label) ? 'lose' : /gain/i.test(label) ? 'gain' : 'maintain';
			const rate = Math.abs(number(record['Goal Rate per Week (%)']) ?? 0);
			const target = measured(record, 'Goal Weight', KG_PER);
			return {
				startedOn: toDay(record['Start Date']),
				kind,
				ratePercentPerWeek: kind === 'lose' ? -rate : kind === 'gain' ? rate : 0,
				...(kind !== 'maintain' && target && { targetWeightKg: target }),
			};
		})
		.toSorted((a, b) => a.startedOn.localeCompare(b.startedOn));
	const updates = new Map<string, Record<string, Cell>[]>();
	for (const record of records(sheets.get('Nutrition Program Settings'))) {
		const day = toDay(record['Program Update Date']);
		updates.set(day, [...(updates.get(day) ?? []), record]);
	}
	for (const [index, day] of [...updates.keys()].toSorted().entries()) {
		const rows = updates.get(day)!;
		const byWeekday = WEEKDAYS.map(weekday => rows.find(row => text(row['Program Weekday']) === weekday));
		if (byWeekday.some(row => !row)) {
			parsed.warnings.push(`Nutrition Program Settings ${day}: not all seven weekdays, skipped`);
			parsed.skipped.nutrition_plans = (parsed.skipped.nutrition_plans ?? 0) + 1;
			continue;
		}
		const targets = byWeekday.map(row => ({
			energy: number(row!['Calories (kcal)']) ?? 0,
			protein: number(row!['Protein (g)']) ?? 0,
			fat: number(row!['Fat (g)']) ?? 0,
			carbs: number(row!['Carbs (g)']) ?? 0,
		}));
		const lowest = Math.min(...targets.map(target => target.energy));
		const first = rows[0]!;
		const expenditure = number(first['Expenditure (kcal)']);
		const weight = measured(first, 'Weight', KG_PER);
		const goal = goals.findLast(candidate => candidate.startedOn <= day) ?? {
			kind: 'maintain',
			ratePercentPerWeek: 0,
			startedOn: day,
		};
		parsed.plans.set(day, {
			kind: index === 0 ? 'setup' : 'check_in',
			goal,
			coaching: {
				style: 'coached',
				diet: 'balanced',
				protein: 'moderate',
				floor: 'standard',
				training: 'lifting',
				highDays: targets.flatMap((target, weekday) => (target.energy > lowest ? [weekday + 1] : [])),
			},
			targets,
			expenditureKcal: expenditure && expenditure > 0 ? expenditure : null,
			trendWeightKg: weight && weight > 0 ? weight : null,
		});
	}
}

/** The profile's sex, birthday, and height. The Height column says inches but holds centimeters, so the value decides. */
function profileOf(record: Record<string, Cell>): Row {
	const sex = text(record.Sex)?.toLowerCase();
	const height = number(record['Height (in)']) ?? number(record['Height (cm)']);
	const birthday = record.Birthday;
	return {
		...((sex === 'male' || sex === 'female') && { sex }),
		...(birthday !== undefined && { birthDate: toDay(birthday) }),
		...(height && { heightCm: height >= 100 ? height : height * CM_PER.in }),
	};
}

/** Sorted keys, as the server stores JSON, so a value read back compares equal to the value sent. */
const stable = (value: unknown): string =>
	JSON.stringify(value, (_key, inner) =>
		inner && typeof inner === 'object' && !Array.isArray(inner)
			? Object.fromEntries(
					Object.keys(inner)
						.toSorted()
						.map(key => [key, inner[key]]),
				)
			: inner,
	);
const same = (existing: Row, desired: Row) =>
	Object.entries(desired).every(([key, value]) => key === 'id' || stable(existing[key] ?? null) === stable(value));

export type Counts = Record<string, { created: number; updated: number; unchanged: number; skipped: number }>;

type Client = (method: string, path: string, body?: unknown) => Promise<any>;

function client(server: string, token: string): Client {
	const base = `${server.replace(/\/+$/, '').replace(/\/api$/, '')}/api`;
	return async (method, path, body) => {
		const response = await fetch(`${base}${path}`, {
			method,
			headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
			...(body !== undefined && { body: JSON.stringify(body) }),
		});
		if (!response.ok) throw new Error(`${method} /api${path}: ${response.status} ${await response.text()}`);
		return response.json();
	};
}

async function every(api: Client, path: string): Promise<Row[]> {
	const rows: Row[] = [];
	const size = 1000;
	for (let offset = 0; ; offset += size) {
		const page: { total: number; items: Row[] } = await api(
			'GET',
			`${path}${path.includes('?') ? '&' : '?'}limit=${size}&offset=${offset}`,
		);
		rows.push(...page.items);
		if (rows.length >= page.total || !page.items.length) return rows;
	}
}

/** Runs `tasks` a few at a time, the server's Durable Object serializing them anyway. */
async function pool(tasks: (() => Promise<unknown>)[], width = 8) {
	let next = 0;
	await Promise.all(
		Array.from({ length: width }, async () => {
			while (next < tasks.length) await tasks[next++]!();
		}),
	);
}

/**
 * Reads the files, compares each row with what the server holds, and writes what differs. A row deleted in the app
 * after an import comes back on the next run: the API does not expose tombstones.
 */
export async function importMacroFactor(options: {
	server: string;
	token: string;
	files: string[];
	dryRun?: boolean;
}): Promise<{ counts: Counts; warnings: string[] }> {
	const api = client(options.server, options.token);
	const root = await api('GET', '');
	if (!root.authenticated) throw new Error('The server did not accept the token');
	const parsed = parseExports(options.files.map(readExport));
	const counts: Counts = {};
	const writes: (() => Promise<unknown>)[] = [];

	function reconcile(
		table: string,
		desired: Map<string, Row>,
		existing: Map<string, Row>,
		create: (key: string, row: Row) => [string, string, Row],
		update: (key: string, row: Row) => [string, string, Row],
	) {
		const count = (counts[table] = { created: 0, updated: 0, unchanged: 0, skipped: parsed.skipped[table] ?? 0 });
		for (const [key, row] of desired) {
			const current = existing.get(key);
			if (current && same(current, row)) {
				count.unchanged++;
				continue;
			}
			const [method, path, body] = current ? update(key, row) : create(key, row);
			count[current ? 'updated' : 'created']++;
			writes.push(() => api(method, path, body));
		}
	}
	const byId = (rows: Row[], key = (row: Row) => String(row.id)) => new Map(rows.map(row => [key(row), row]));
	const post =
		(path: string) =>
		(_key: string, row: Row): [string, string, Row] => ['POST', path, row];
	const patch =
		(path: string) =>
		(key: string, { id: _, ...row }: Row): [string, string, Row] => ['PATCH', `${path}/${key}`, row];
	const put =
		(path: string) =>
		(key: string, row: Row): [string, string, Row] => ['PUT', `${path}/${key}`, row];

	reconcile('foods', parsed.foods, byId(await every(api, '/foods')), post('/foods'), patch('/foods'));
	reconcile('recipes', parsed.recipes, byId(await every(api, '/recipes')), post('/recipes'), patch('/recipes'));
	const entries = byId(await every(api, '/food-entries'));
	reconcile('food_entries', parsed.entries, entries, post('/food-entries'), patch('/food-entries'));

	const weights = await every(api, '/body-weights');
	const fatFills = new Map<string, Row>();
	for (const [id, row] of parsed.weights) {
		const at = Date.parse(String(row.measuredAt));
		const day = String(row.measuredAt).slice(0, 10);
		const twin = weights.find(
			other =>
				other.id !== id &&
				(Math.abs(Date.parse(String(other.measuredAt)) - at) < SAME_MOMENT_MS ||
					(String(other.measuredAt).slice(0, 10) === day &&
						Math.abs(Number(other.weightKg) - Number(row.weightKg)) < SAME_WEIGHT_KG)),
		);
		if (!twin) continue;
		parsed.weights.delete(id);
		if (row.bodyFatPercent !== null && twin.bodyFatPercent === null) {
			fatFills.set(String(twin.id), { ...twin, bodyFatPercent: row.bodyFatPercent });
		} else parsed.skipped.body_weights = (parsed.skipped.body_weights ?? 0) + 1;
	}
	const existingWeights = byId(weights);
	reconcile(
		'body_weights',
		new Map([...parsed.weights, ...fatFills]),
		existingWeights,
		post('/body-weights'),
		patch('/body-weights'),
	);
	reconcile(
		'body_metrics',
		parsed.metrics,
		byId(await every(api, '/body-metrics')),
		put('/body-metrics'),
		put('/body-metrics'),
	);

	const existingDays = byId(await api('GET', '/nutrition-days'));
	const itemized = new Set([
		...[...parsed.entries.values()].map(row => String(row.day)),
		...[...entries.values()].map(row => String(row.day)),
	]);
	const days = new Map<string, Row>();
	for (const day of new Set([...parsed.totals.keys(), ...parsed.statuses.keys()])) {
		const status = parsed.statuses.get(day) ?? 'none';
		const totals = parsed.totals.get(day);
		const current = existingDays.get(day);
		if (!itemized.has(day)) days.set(day, { status, override: totals ?? null });
		else if (status !== 'none') days.set(day, { status, override: null });
		else if (current && totals && stable(current.override) === stable(totals))
			days.set(day, { status: current.status, override: null });
	}
	reconcile('nutrition_days', days, existingDays, put('/nutrition-days'), put('/nutrition-days'));
	reconcile(
		'nutrition_plans',
		parsed.plans,
		byId(await api('GET', '/nutrition-plans')),
		put('/nutrition-plans'),
		put('/nutrition-plans'),
	);

	if (parsed.profile && Object.keys(parsed.profile).length) {
		const { profile } = await api('GET', '/settings');
		const settings = new Map([['settings', parsed.profile]]);
		reconcile(
			'settings',
			settings,
			new Map([['settings', profile]]),
			() => ['PATCH', '/settings', { profile: parsed.profile }],
			() => ['PATCH', '/settings', { profile: parsed.profile }],
		);
	}

	if (!options.dryRun) await pool(writes);
	return { counts, warnings: parsed.warnings };
}

function format(counts: Counts) {
	const columns = ['created', 'updated', 'unchanged', 'skipped'] as const;
	const width = Math.max(...Object.keys(counts).map(name => name.length), 5);
	const lines = [['table'.padEnd(width), ...columns.map(column => column.padStart(9))].join(' ')];
	for (const [name, count] of Object.entries(counts))
		lines.push([name.padEnd(width), ...columns.map(column => String(count[column]).padStart(9))].join(' '));
	return lines.join('\n');
}

if (import.meta.main) {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: { server: { type: 'string' }, token: { type: 'string' }, 'dry-run': { type: 'boolean', default: false } },
	});
	if (!values.server || !values.token || !positionals.length) {
		console.error('Usage: bun scripts/import-macrofactor.ts --server <url> --token <token> <files...> [--dry-run]');
		process.exit(2);
	}
	const { counts, warnings } = await importMacroFactor({
		server: values.server,
		token: values.token,
		files: positionals,
		dryRun: values['dry-run'],
	});
	for (const warning of warnings) console.warn(`warning: ${warning}`);
	console.log(format(counts));
	if (values['dry-run']) console.log('Dry run: nothing was written.');
}
