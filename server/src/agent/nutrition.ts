import { z } from 'zod';
import { BODY_METRIC_KINDS, nutrientID, type SyncedTable } from '../../../shared/db/schema';
import { ApiError, type Db, type RowOf } from './db';
import * as M from './models';
import { limit, offset, route, where, type Route } from './route';

type Amounts = Record<string, number>;
type Snapshot = z.output<typeof M.FoodSnapshot>;
type Serving = z.output<typeof M.Serving>;
type Nutrition = z.output<typeof M.FoodNutrition>;
type Portion = { food?: Snapshot; foodId?: string; recipeId?: string; serving?: Serving };

/** The app's caps, `FoodLogNote.limitPerDay` and `FoodFavorite.limit`. */
const NOTES_PER_DAY = 5;
const FAVORITES = 50;

/** `Serving.servings`: the base servings eaten, the one factor every amount scales by. */
const servings = (serving: Serving) => (serving.measure.servings * serving.quantity) / serving.measure.quantity;
const scaled = (amounts: Amounts, factor: number) =>
	Object.fromEntries(Object.entries(amounts).map(([key, value]) => [key, value * factor]));
const netCarbs = (amounts: Amounts) =>
	amounts.nc ?? (amounts.c === undefined ? undefined : Math.max(0, amounts.c - (amounts['291'] ?? 0)));

/** `NutrientAmounts +`: once either side reports net carbs, the sum carries them, the other side's derived. */
function add(left: Amounts, right: Amounts): Amounts {
	const sum = { ...left };
	for (const [key, value] of Object.entries(right)) sum[key] = (sum[key] ?? 0) + value;
	if (left.nc !== undefined || right.nc !== undefined) sum.nc = (netCarbs(left) ?? 0) + (netCarbs(right) ?? 0);
	return sum;
}

const amounts = (food: Snapshot, serving: Serving) => scaled(food.nutrition.nutrients, servings(serving));
const total = (portions: { food: Snapshot; serving: Serving }[]) =>
	portions.reduce<Amounts>((sum, eaten) => add(sum, amounts(eaten.food, eaten.serving)), {});

/** `Recipe.nutrition`: per serving of the yield, weighable when the cooked weight is known. */
function recipeNutrition(row: RowOf<'recipes'>): Nutrition {
	const ingredients = row.ingredients as z.output<typeof M.RecipeIngredient>[];
	return {
		nutrients: scaled(total(ingredients), 1 / row.servings),
		...(row.cookedGrams && { baseGrams: row.cookedGrams / row.servings }),
		measures: [{ name: 'serving', quantity: 1, servings: 1 }],
	};
}

const recipe = (row: RowOf<'recipes'>) => ({ ...row, nutrition: recipeNutrition(row) });
const entry = (row: RowOf<'food_entries'>) => ({
	...row,
	amounts: amounts(row.food as Snapshot, row.serving as Serving),
});

/** Snapshots leave out absent strings: the validators take a missing `brand`, not a null one. */
function snapshot(foodID: string, source: Snapshot['source'], name: string, nutrition: Nutrition, extra: object) {
	const optional = Object.entries(extra).filter(([, value]) => value !== null && value !== undefined);
	return { foodID, source, name, nutrition, ...Object.fromEntries(optional) } as Snapshot;
}

/** A portion input as stored: the given snapshot or one taken from a stored food or recipe, at its default serving. */
function portion(db: Db, input: Portion) {
	let food = input.food;
	if (input.foodId) {
		const row = db.find('foods', input.foodId, 'food');
		food = snapshot(row.id, row.source, row.name, row.nutrition as Nutrition, { brand: row.brand, icon: row.icon });
	}
	if (input.recipeId) {
		const row = db.find('recipes', input.recipeId.toLowerCase(), 'recipe');
		food = snapshot(row.id, 'recipe', row.name, recipeNutrition(row), { icon: row.icon });
	}
	const [first] = food!.nutrition.measures;
	return { food: food!, serving: input.serving ?? { measure: first!, quantity: first!.quantity } };
}

/** The id a create writes: the given one, lowercased, unless a row has it already, or a new one. */
export function fresh(db: Db, table: SyncedTable, id: string | undefined): string {
	if (!id) return M.newId();
	const key = id.toLowerCase();
	if (db.get(table, key)) throw new ApiError(409, `${table} ${key} already exists. PATCH it instead.`);
	return key;
}

const FOOD_IDS: Record<RowOf<'foods'>['source'], [RegExp, string]> = {
	custom: [/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, 'a UUID'],
	usda: [/^usda-\d+$/, '`usda-<fdcId>`'],
	open_food_facts: [/^off-\S+$/, '`off-<barcode>`'],
};

const NESTED = ['coachingModules', 'timeline', 'logger', 'expenditure'] as const;

/** `profile`-style merge, one level deeper for the nested groups. */
export function mergeNutrition(
	current: Record<string, unknown>,
	patch: z.output<typeof M.SettingsPatch>['nutrition'],
): Record<string, unknown> {
	if (!patch) return current;
	const merged: Record<string, unknown> = { ...current, ...patch };
	for (const key of NESTED) {
		if (patch[key]) merged[key] = { ...(current[key] as object | undefined), ...patch[key] };
	}
	return merged;
}

const days = z.object({
	from: M.day.optional().meta({ description: 'The first day, inclusive.' }),
	to: M.day.optional().meta({ description: 'The last day, inclusive.' }),
});
function dayRange(column: string, query: { from?: string; to?: string }) {
	const conditions: [string, ...(string | number)[]][] = [];
	if (query.from) conditions.push([`${column} >= ?`, query.from]);
	if (query.to) conditions.push([`${column} <= ?`, query.to]);
	return conditions;
}
const page = { limit: limit(500, 5000), offset };

function list<T extends SyncedTable>(
	db: Db,
	table: T,
	conditions: [string, ...(string | number)[]][],
	order: string,
	query?: { limit: number; offset: number },
) {
	const [sql, params] = where(conditions);
	const paging = query ? ` LIMIT ${query.limit} OFFSET ${query.offset}` : '';
	return db.all(table, `${sql ?? '1'} ORDER BY ${order}${paging}`, params);
}

const dayParam = (params: Record<string, string>) => M.day.parse(params.day);
const assertNoteRoom = (db: Db, day: string, except = '') => {
	if (db.all('food_log_notes', 'day = ? AND id != ?', [day, except]).length >= NOTES_PER_DAY)
		throw new ApiError(409, `${day} already has ${NOTES_PER_DAY} notes, the most a day takes`);
};

export const nutritionRoutes: Route[] = [
	route({
		method: 'GET',
		path: '/foods',
		tag: 'Foods',
		summary: "List the owner's custom foods and the cached USDA and Open Food Facts foods",
		query: z.object({
			q: z.string().optional().meta({ description: 'Matches the name or brand, case-insensitively.' }),
			source: z.enum(['custom', 'usda', 'open_food_facts']).optional(),
			archived: z.stringbool().optional(),
			...page,
		}),
		response: z.array(M.Food),
		run({ db, query }) {
			const conditions: [string, ...(string | number)[]][] = [];
			if (query.q)
				conditions.push([
					'(instr(lower(name), ?) > 0 OR instr(lower(brand), ?) > 0)',
					...Array(2).fill(query.q.toLowerCase()),
				]);
			if (query.source) conditions.push(['source = ?', query.source]);
			if (query.archived !== undefined) conditions.push(['archived = ?', query.archived ? 1 : 0]);
			return list(db, 'foods', conditions, 'name, id', query);
		},
	}),
	route({
		method: 'GET',
		path: '/foods/{id}',
		tag: 'Foods',
		summary: 'Get a food',
		response: M.Food,
		run: ({ db, params }) => db.find('foods', params.id!, 'food'),
	}),
	route({
		method: 'POST',
		path: '/foods',
		tag: 'Foods',
		summary: 'Create a custom food, or cache a USDA or Open Food Facts one',
		description: 'Logging it is a separate POST /food-entries with `foodId`.',
		body: M.FoodCreate,
		response: M.Food,
		run({ db, body, now }) {
			const [pattern, shape] = FOOD_IDS[body.source];
			if (body.id && !pattern.test(body.id.toLowerCase()))
				throw new ApiError(400, `A ${body.source} food's id is ${shape}`);
			if (!body.id && body.source !== 'custom') throw new ApiError(400, `A ${body.source} food's id is ${shape}`);
			const row: RowOf<'foods'> = { ...body, id: fresh(db, 'foods', body.id), createdAt: now, updatedAt: now };
			db.commit(db.put('foods', row));
			return row;
		},
	}),
	route({
		method: 'PATCH',
		path: '/foods/{id}',
		tag: 'Foods',
		summary: 'Edit or archive a food',
		description: 'Entries, favorites, and recipe ingredients keep the snapshot they took.',
		body: M.FoodPatch,
		response: M.Food,
		run({ db, params, body, now }) {
			db.find('foods', params.id!, 'food');
			db.commit(db.patch('foods', params.id!, { ...body, updatedAt: now }));
			return db.find('foods', params.id!, 'food');
		},
	}),
	route({
		method: 'DELETE',
		path: '/foods/{id}',
		tag: 'Foods',
		summary: 'Delete a food',
		description: 'The log keeps every entry of it. Prefer archiving.',
		response: M.Deleted,
		run({ db, params }) {
			db.find('foods', params.id!, 'food');
			db.commit(db.delete('foods', params.id!));
			return { deleted: params.id! };
		},
	}),

	route({
		method: 'GET',
		path: '/recipes',
		tag: 'Recipes',
		summary: 'List recipes, with the nutrition each derives from its ingredients',
		query: z.object({ q: z.string().optional(), archived: z.stringbool().optional(), ...page }),
		response: z.array(M.Recipe),
		run({ db, query }) {
			const conditions: [string, ...(string | number)[]][] = [];
			if (query.q) conditions.push(['instr(lower(name), ?) > 0', query.q.toLowerCase()]);
			if (query.archived !== undefined) conditions.push(['archived = ?', query.archived ? 1 : 0]);
			return list(db, 'recipes', conditions, 'name, id', query).map(recipe);
		},
	}),
	route({
		method: 'GET',
		path: '/recipes/{id}',
		tag: 'Recipes',
		summary: 'Get a recipe',
		response: M.Recipe,
		run: ({ db, params }) => recipe(db.find('recipes', params.id!.toLowerCase(), 'recipe')),
	}),
	route({
		method: 'POST',
		path: '/recipes',
		tag: 'Recipes',
		summary: 'Create a recipe',
		description: 'Each ingredient is a food snapshot at a serving, or a stored food or recipe by id.',
		body: M.RecipeCreate,
		response: M.Recipe,
		run({ db, body, now }) {
			const row: RowOf<'recipes'> = {
				...body,
				id: fresh(db, 'recipes', body.id),
				ingredients: body.ingredients.map(({ id, ...input }) => ({ id, ...portion(db, input) })),
				createdAt: now,
				updatedAt: now,
			};
			db.commit(db.put('recipes', row));
			return recipe(row);
		},
	}),
	route({
		method: 'PATCH',
		path: '/recipes/{id}',
		tag: 'Recipes',
		summary: 'Edit or archive a recipe',
		description: '`ingredients` and `steps` replace the whole list. Entries logged from it keep their snapshot.',
		body: M.RecipePatch,
		response: M.Recipe,
		run({ db, params, body, now }) {
			const id = db.find('recipes', params.id!.toLowerCase(), 'recipe').id;
			const ingredients = body.ingredients?.map(({ id: key, ...input }) => ({ id: key, ...portion(db, input) }));
			db.commit(db.patch('recipes', id, { ...body, ...(ingredients && { ingredients }), updatedAt: now }));
			return recipe(db.find('recipes', id, 'recipe'));
		},
	}),
	route({
		method: 'DELETE',
		path: '/recipes/{id}',
		tag: 'Recipes',
		summary: 'Delete a recipe',
		response: M.Deleted,
		run({ db, params }) {
			const id = db.find('recipes', params.id!.toLowerCase(), 'recipe').id;
			db.commit(db.delete('recipes', id));
			return { deleted: id };
		},
	}),

	route({
		method: 'GET',
		path: '/food-log/{day}',
		tag: 'Food log',
		summary: 'A day of the food log: its entries, notes, totals, and what the owner said about it',
		response: M.FoodLogDay,
		run({ db, params }) {
			const day = dayParam(params);
			const entries = db.all('food_entries', 'day = ? ORDER BY minute, created_at, id', [day]).map(entry);
			const row = db.get('nutrition_days', day);
			return {
				day,
				status: row?.status ?? 'none',
				override: row?.override ?? null,
				totals: total(entries as { food: Snapshot; serving: Serving }[]),
				entries,
				notes: db.all('food_log_notes', 'day = ? ORDER BY minute, id', [day]),
			};
		},
	}),
	route({
		method: 'GET',
		path: '/food-entries',
		tag: 'Food log',
		summary: 'List logged foods, oldest first',
		query: days.extend(page),
		response: z.array(M.FoodEntry),
		run: ({ db, query }) =>
			list(db, 'food_entries', dayRange('day', query), 'day, minute, created_at, id', query).map(entry),
	}),
	route({
		method: 'GET',
		path: '/food-entries/{id}',
		tag: 'Food log',
		summary: 'Get a logged food',
		response: M.FoodEntry,
		run: ({ db, params }) => entry(db.find('food_entries', params.id!.toLowerCase(), 'food entry')),
	}),
	route({
		method: 'POST',
		path: '/food-entries',
		tag: 'Food log',
		summary: 'Log a food',
		description:
			'Give the food as a snapshot (`food`), or a stored one by `foodId` or `recipeId`. A quick add is a snapshot with the source `quick_add` and one `serving` measure.',
		body: M.FoodEntryCreate,
		response: M.FoodEntry,
		run({ db, body, now }) {
			const { id, day, minute, ...input } = body;
			const row: RowOf<'food_entries'> = {
				id: fresh(db, 'food_entries', id),
				day,
				minute,
				...portion(db, input),
				createdAt: now,
				updatedAt: now,
			};
			db.commit(db.put('food_entries', row));
			return entry(row);
		},
	}),
	route({
		method: 'PATCH',
		path: '/food-entries/{id}',
		tag: 'Food log',
		summary: 'Move a logged food, change its serving, or swap its food',
		body: M.FoodEntryPatch,
		response: M.FoodEntry,
		run({ db, params, body, now }) {
			const id = db.find('food_entries', params.id!.toLowerCase(), 'food entry').id;
			db.commit(db.patch('food_entries', id, { ...body, updatedAt: now }));
			return entry(db.find('food_entries', id, 'food entry'));
		},
	}),
	route({
		method: 'DELETE',
		path: '/food-entries/{id}',
		tag: 'Food log',
		summary: 'Delete a logged food',
		response: M.Deleted,
		run({ db, params }) {
			const id = db.find('food_entries', params.id!.toLowerCase(), 'food entry').id;
			db.commit(db.delete('food_entries', id));
			return { deleted: id };
		},
	}),

	route({
		method: 'GET',
		path: '/nutrition-days',
		tag: 'Food log',
		summary: 'List the days the owner marked fasted or partial, or whose totals they set',
		query: days,
		response: z.array(M.NutritionDay),
		run: ({ db, query }) => list(db, 'nutrition_days', dayRange('id', query), 'id'),
	}),
	route({
		method: 'PUT',
		path: '/nutrition-days/{day}',
		tag: 'Food log',
		summary: "Mark a day fasted or partial, or set the totals that replace its log's",
		description:
			"MacroFactor's Nutrition Data Manager. A partial day is skipped by the expenditure algorithm; an empty fasted day counts as zero. An `override` counts in place of the entries.",
		body: M.NutritionDayPut,
		response: M.NutritionDay,
		run({ db, params, body }) {
			const row: RowOf<'nutrition_days'> = { id: dayParam(params), ...body };
			db.commit(db.put('nutrition_days', row));
			return row;
		},
	}),
	route({
		method: 'DELETE',
		path: '/nutrition-days/{day}',
		tag: 'Food log',
		summary: 'Make a day a plain logged day again',
		response: M.Deleted,
		run({ db, params }) {
			const id = db.find('nutrition_days', dayParam(params), 'nutrition day').id;
			db.commit(db.delete('nutrition_days', id));
			return { deleted: id };
		},
	}),

	route({
		method: 'GET',
		path: '/food-log-notes',
		tag: 'Food log',
		summary: 'List food log notes, oldest first',
		query: days,
		response: z.array(M.FoodLogNote),
		run: ({ db, query }) => list(db, 'food_log_notes', dayRange('day', query), 'day, minute, id'),
	}),
	route({
		method: 'POST',
		path: '/food-log-notes',
		tag: 'Food log',
		summary: 'Add a note to a day of the food log',
		description: 'A day takes five notes; a sixth is refused with 409.',
		body: M.FoodLogNoteCreate,
		response: M.FoodLogNote,
		run({ db, body }) {
			assertNoteRoom(db, body.day);
			const row: RowOf<'food_log_notes'> = { ...body, id: fresh(db, 'food_log_notes', body.id) };
			db.commit(db.put('food_log_notes', row));
			return row;
		},
	}),
	route({
		method: 'PATCH',
		path: '/food-log-notes/{id}',
		tag: 'Food log',
		summary: 'Edit or move a food log note',
		body: M.FoodLogNotePatch,
		response: M.FoodLogNote,
		run({ db, params, body }) {
			const existing = db.find('food_log_notes', params.id!.toLowerCase(), 'note');
			if (body.day && body.day !== existing.day) assertNoteRoom(db, body.day, existing.id);
			db.commit(db.patch('food_log_notes', existing.id, body));
			return db.find('food_log_notes', existing.id, 'note');
		},
	}),
	route({
		method: 'DELETE',
		path: '/food-log-notes/{id}',
		tag: 'Food log',
		summary: 'Delete a food log note',
		response: M.Deleted,
		run({ db, params }) {
			const id = db.find('food_log_notes', params.id!.toLowerCase(), 'note').id;
			db.commit(db.delete('food_log_notes', id));
			return { deleted: id };
		},
	}),

	route({
		method: 'GET',
		path: '/food-favorites',
		tag: 'Foods',
		summary: 'List favorites, oldest first',
		response: z.array(M.FoodFavorite),
		run: ({ db }) => db.all('food_favorites', '1 ORDER BY created_at, id'),
	}),
	route({
		method: 'POST',
		path: '/food-favorites',
		tag: 'Foods',
		summary: 'Save a food at a serving as a favorite',
		description: `At ${FAVORITES} favorites, saving another deletes the oldest, as the app does.`,
		body: M.FoodFavoriteCreate,
		response: M.FoodFavorite,
		run({ db, body, now }) {
			const { id, ...input } = body;
			const row: RowOf<'food_favorites'> = {
				id: fresh(db, 'food_favorites', id),
				...portion(db, input),
				createdAt: now,
			};
			const existing = db.all('food_favorites', '1 ORDER BY created_at, id');
			const evicted = existing.slice(0, Math.max(0, existing.length - FAVORITES + 1));
			db.commit(...evicted.map(old => db.delete('food_favorites', old.id)), db.put('food_favorites', row));
			return row;
		},
	}),
	route({
		method: 'DELETE',
		path: '/food-favorites/{id}',
		tag: 'Foods',
		summary: 'Delete a favorite',
		response: M.Deleted,
		run({ db, params }) {
			const id = db.find('food_favorites', params.id!.toLowerCase(), 'favorite').id;
			db.commit(db.delete('food_favorites', id));
			return { deleted: id };
		},
	}),

	route({
		method: 'GET',
		path: '/body-metrics',
		tag: 'Body weight',
		summary: 'List visual body fat, tape measurements, and step counts, oldest first',
		query: days.extend({ kind: z.enum(BODY_METRIC_KINDS).optional(), ...page }),
		response: z.array(M.BodyMetric),
		run({ db, query }) {
			const conditions = dayRange('day', query);
			if (query.kind) conditions.push(['kind = ?', query.kind]);
			return list(db, 'body_metrics', conditions, 'day, kind', query);
		},
	}),
	route({
		method: 'PUT',
		path: '/body-metrics/{day}/{kind}',
		tag: 'Body weight',
		summary: "Set a day's value of a body metric",
		description: 'Centimeters for tape measurements, a percent for `visual_body_fat`, a count for `steps`.',
		body: M.BodyMetricPut,
		response: M.BodyMetric,
		run({ db, params, body, now }) {
			const day = dayParam(params);
			const kind = z.enum(BODY_METRIC_KINDS).parse(params.kind);
			const row: RowOf<'body_metrics'> = { id: `${day}/${kind}`, day, kind, value: body.value, updatedAt: now };
			db.commit(db.put('body_metrics', row));
			return row;
		},
	}),
	route({
		method: 'DELETE',
		path: '/body-metrics/{day}/{kind}',
		tag: 'Body weight',
		summary: "Clear a day's value of a body metric",
		response: M.Deleted,
		run({ db, params }) {
			const id = db.find('body_metrics', `${dayParam(params)}/${params.kind}`, 'body metric').id;
			db.commit(db.delete('body_metrics', id));
			return { deleted: id };
		},
	}),

	route({
		method: 'GET',
		path: '/nutrition-plans',
		tag: 'Strategy',
		summary: 'List nutrition plans, oldest first: goal history and check-in history',
		response: z.array(M.NutritionPlan),
		run: ({ db }) => db.all('nutrition_plans', '1 ORDER BY id'),
	}),
	route({
		method: 'GET',
		path: '/nutrition-plans/{day}',
		tag: 'Strategy',
		summary: 'Get the plan that starts on a day',
		response: M.NutritionPlan,
		run: ({ db, params }) => db.find('nutrition_plans', dayParam(params), 'plan'),
	}),
	route({
		method: 'PUT',
		path: '/nutrition-plans/{day}',
		tag: 'Strategy',
		summary: 'Set the goal, program, and targets from a day on',
		description: 'Replaces a plan that starts the same day. Past days keep the plan in force on them.',
		body: M.NutritionPlanPut,
		response: M.NutritionPlan,
		run({ db, params, body, now }) {
			const id = dayParam(params);
			const row: RowOf<'nutrition_plans'> = { id, ...body, createdAt: db.get('nutrition_plans', id)?.createdAt ?? now };
			db.commit(db.put('nutrition_plans', row));
			return row;
		},
	}),
	route({
		method: 'DELETE',
		path: '/nutrition-plans/{day}',
		tag: 'Strategy',
		summary: 'Delete the plan that starts on a day',
		response: M.Deleted,
		run({ db, params }) {
			const id = db.find('nutrition_plans', dayParam(params), 'plan').id;
			db.commit(db.delete('nutrition_plans', id));
			return { deleted: id };
		},
	}),

	route({
		method: 'GET',
		path: '/nutrient-goals',
		tag: 'Strategy',
		summary: 'List per-nutrient goals, oldest first',
		query: z.object({ nutrient: nutrientID.optional() }),
		response: z.array(M.NutrientGoal),
		run: ({ db, query }) =>
			list(db, 'nutrient_goals', query.nutrient ? [['nutrient = ?', query.nutrient]] : [], 'starts_on, nutrient'),
	}),
	route({
		method: 'PUT',
		path: '/nutrient-goals/{day}/{nutrient}',
		tag: 'Strategy',
		summary: "Set a nutrient's floor, target, and ceiling from a day on",
		body: M.NutrientGoalPut,
		response: M.NutrientGoal,
		run({ db, params, body }) {
			const startsOn = dayParam(params);
			const nutrient = nutrientID.parse(params.nutrient);
			const bounds = body.mode === 'custom' ? body : { floor: null, target: null, ceiling: null };
			const row: RowOf<'nutrient_goals'> = {
				id: `${startsOn}/${nutrient}`,
				nutrient,
				startsOn,
				...bounds,
				mode: body.mode,
			};
			db.commit(db.put('nutrient_goals', row));
			return row;
		},
	}),
	route({
		method: 'DELETE',
		path: '/nutrient-goals/{day}/{nutrient}',
		tag: 'Strategy',
		summary: 'Delete a per-nutrient goal',
		response: M.Deleted,
		run({ db, params }) {
			const id = db.find('nutrient_goals', `${dayParam(params)}/${params.nutrient}`, 'nutrient goal').id;
			db.commit(db.delete('nutrient_goals', id));
			return { deleted: id };
		},
	}),
];
