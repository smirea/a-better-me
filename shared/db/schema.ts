import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { defineSchema } from 'sync-engine/core';
import { z } from 'zod';

/**
 * The synced tables, one SQLite schema that the server's space and every device run as the same DDL. Each table
 * mirrors a Swift model in `app-ios/Sources/App/Workouts/Model/` or `Nutrition/Model/`: ids are client-made, ordered
 * trees stay one JSON column, instants are ISO 8601 UTC text with milliseconds, and a calendar day (the nutrition log's
 * unit) is `YYYY-MM-DD` text. A column default is what a put that leaves the column out gets, so every column added
 * later needs a default or must be nullable.
 */

const json = (name: string) => text(name, { mode: 'json' });
const bool = (name: string) => integer(name, { mode: 'boolean' });

export const SETTINGS_ID = 'settings';
export const WEIGHT_UNITS = ['kg', 'lb'] as const;
export const BODY_WEIGHT_SOURCES = ['manual', 'healthkit'] as const;
/** Where a food snapshot came from. Only the first three are rows of `foods`; recipes and quick adds are snapshots. */
export const FOOD_SOURCES = ['custom', 'usda', 'open_food_facts', 'recipe', 'quick_add'] as const;
export const FOOD_ROW_SOURCES = ['custom', 'usda', 'open_food_facts'] as const;
export const DAY_STATUSES = ['none', 'partial', 'fasted'] as const;
export const NOTE_COLORS = ['red', 'blue', 'green', 'yellow', 'purple'] as const;
export const BODY_METRIC_KINDS = [
	'visual_body_fat',
	'steps',
	'neck',
	'shoulders',
	'bust',
	'chest',
	'waist',
	'hips',
	'left_bicep',
	'right_bicep',
	'left_forearm',
	'right_forearm',
	'left_wrist',
	'right_wrist',
	'left_thigh',
	'right_thigh',
	'left_calf',
	'right_calf',
	'left_ankle',
	'right_ankle',
] as const;
export const TRAINING_TYPES = ['none', 'lifting', 'cardio', 'cardio_lifting'] as const;
export const PLAN_KINDS = ['setup', 'check_in', 'edit'] as const;
export const GOAL_KINDS = ['lose', 'maintain', 'gain'] as const;
export const PROGRAM_STYLES = ['coached', 'collaborative', 'manual'] as const;
export const DIET_STYLES = ['balanced', 'low_fat', 'low_carb', 'keto'] as const;
export const PROTEIN_LEVELS = ['low', 'moderate', 'high', 'extra_high'] as const;
export const CALORIE_FLOORS = ['standard', 'low', 'ignored'] as const;
export const NUTRIENT_GOAL_MODES = ['auto', 'custom', 'none'] as const;

export const workoutTemplates = sqliteTable('workout_templates', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	notes: text('notes').notNull().default(''),
	/** `[WorkoutBlock]`, the ordered block tree a session copies when it starts from this template. */
	blocks: json('blocks').notNull().default([]),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
	/** The program this template is a day of. Not a foreign key, like `template_id`. */
	programId: text('program_id'),
	gymId: text('gym_id'),
	archived: bool('archived').notNull().default(false),
});

export const workoutSessions = sqliteTable('workout_sessions', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	/** The template it started from. Not a foreign key: deleting a template keeps its history. */
	templateId: text('template_id'),
	startedAt: text('started_at').notNull(),
	/** Null while the workout is in progress. */
	endedAt: text('ended_at'),
	notes: text('notes').notNull().default(''),
	blocks: json('blocks').notNull().default([]),
	programId: text('program_id'),
	/** `ProgramDay.id` inside the program's `days`. */
	programDayId: text('program_day_id'),
	cycle: integer('cycle'),
	gymId: text('gym_id'),
	pausedSeconds: integer('paused_seconds').notNull().default(0),
	/** What the workout recorded in Apple Health (`WorkoutHealthSummary`), null until it is saved there. */
	health: json('health'),
});

export const customExercises = sqliteTable('custom_exercises', {
	id: text('id').primaryKey(),
	/** The whole `Exercise`, as the app encodes it. */
	exercise: json('exercise').notNull(),
	isArchived: bool('is_archived').notNull().default(false),
});

/** Keyed by the exercise's ID, so two devices editing one exercise's settings offline converge on one row. */
export const exerciseSettings = sqliteTable('exercise_settings', {
	id: text('id').primaryKey(),
	pinnedNote: text('pinned_note').notNull().default(''),
	restSeconds: integer('rest_seconds'),
	doNotRecommend: bool('do_not_recommend').notNull().default(false),
	/** `ExerciseOverrides`: every key optional, `{}` is all defaults. */
	overrides: json('overrides').notNull().default({}),
});

/** One row with the id `settings`. The rest defaults are `RestCategory.defaultSeconds`. */
export const settings = sqliteTable('settings', {
	id: text('id').primaryKey(),
	weightUnit: text('weight_unit', { enum: WEIGHT_UNITS }).notNull().default('kg'),
	restCompoundUpper: integer('rest_compound_upper').notNull().default(120),
	restCompoundLower: integer('rest_compound_lower').notNull().default(180),
	restUpperIsolation: integer('rest_upper_isolation').notNull().default(90),
	restLowerIsolation: integer('rest_lower_isolation').notNull().default(90),
	restCore: integer('rest_core').notNull().default(60),
	/** `WorkoutSettings`, `ProfileSettings`, `DashboardLayout`, `ShortcutsLayout`: each rewritten whole by the app. */
	workout: json('workout').notNull().default({}),
	profile: json('profile').notNull().default({}),
	dashboard: json('dashboard').notNull().default({}),
	shortcuts: json('shortcuts').notNull().default({}),
	/** `NutritionSettings`, rewritten whole by the app like the four above. */
	nutrition: json('nutrition').notNull().default({}),
});

export const programs = sqliteTable('programs', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	color: text('color').notNull(),
	icon: text('icon').notNull(),
	cycles: integer('cycles').notNull(),
	currentCycle: integer('current_cycle').notNull().default(1),
	/** At most one program is meant to be active. The app keeps it so (`LocalStore.activateProgram`); no index enforces it. */
	active: bool('active').notNull().default(false),
	archived: bool('archived').notNull().default(false),
	config: json('config').notNull().default({}),
	/** `[ProgramDay]`, in cycle order: `{ id, templateID? }`, a rest day without `templateID`. */
	days: json('days').notNull().default([]),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
});

export const gymProfiles = sqliteTable('gym_profiles', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	icon: text('icon').notNull(),
	isDefault: bool('is_default').notNull().default(false),
	/** `{ [equipmentId]: GymEquipment }`, the selected items and their weight overrides. */
	equipment: json('equipment').notNull().default({}),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
});

export const bodyWeights = sqliteTable('body_weights', {
	id: text('id').primaryKey(),
	measuredAt: text('measured_at').notNull(),
	weightKg: real('weight_kg').notNull(),
	source: text('source', { enum: BODY_WEIGHT_SOURCES }).notNull().default('manual'),
	/** The scale's body fat percent, entered with the weight. */
	bodyFatPercent: real('body_fat_percent'),
});

/**
 * A bot token for the agent API (`/api`), made and revoked on a device. Only the SHA-256 of the token syncs, so the
 * server and the backups never hold a usable token. Revoking deletes the row.
 */
export const apiTokens = sqliteTable('api_tokens', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	/** Lowercase hex SHA-256 of the whole token, `abm_` prefix included. */
	tokenHash: text('token_hash').notNull(),
	/** The token's first characters, so the owner can tell tokens apart. */
	hint: text('hint').notNull().default(''),
	createdAt: text('created_at').notNull(),
});

/**
 * A food the owner made, or a USDA or Open Food Facts food cached the first time it was used. The id is a lowercase
 * UUID for a custom food and `usda-<fdcId>` or `off-<barcode>` for a cached one, so two devices caching one food
 * converge on one row. Nothing references a food by id for its values: entries, favorites, and recipes hold snapshots.
 */
export const foods = sqliteTable('foods', {
	id: text('id').primaryKey(),
	source: text('source', { enum: FOOD_ROW_SOURCES }).notNull().default('custom'),
	name: text('name').notNull(),
	brand: text('brand'),
	barcode: text('barcode'),
	/** The food icon's name, or null for the default. */
	icon: text('icon'),
	/** `FoodNutrition`: sparse nutrients per base serving and the measures it can be logged in. */
	nutrition: json('nutrition').notNull().default({}),
	archived: bool('archived').notNull().default(false),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
});

export const recipes = sqliteTable('recipes', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	icon: text('icon'),
	/** `[RecipeIngredient]`, in order: `{ id, food: FoodSnapshot, serving: Serving }`. */
	ingredients: json('ingredients').notNull().default([]),
	/** How many servings the whole recipe makes. */
	servings: real('servings').notNull().default(1),
	/** The weight of everything the recipe makes, once cooked, which unlocks logging it by weight. */
	cookedGrams: real('cooked_grams'),
	/** `[String]`, the preparation steps. */
	steps: json('steps').notNull().default([]),
	prepMinutes: integer('prep_minutes'),
	cookMinutes: integer('cook_minutes'),
	/** The page it was imported from. */
	link: text('link'),
	notes: text('notes').notNull().default(''),
	archived: bool('archived').notNull().default(false),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
});

/**
 * One logged food at a time of a calendar day; MacroFactor's timeline groups entries by hour of a calendar day. `food` is a snapshot taken when it was logged, so
 * editing or deleting the food never rewrites the log. `food` and `serving` are separate columns because a move, a
 * serving change, and a food swap are separate edits; the measure and its quantity share `serving` so a merge never
 * pairs one device's unit with another's amount.
 */
export const foodEntries = sqliteTable('food_entries', {
	id: text('id').primaryKey(),
	day: text('day').notNull(),
	/** Minutes since midnight, 0 through 1439. */
	minute: integer('minute').notNull().default(720),
	/** `FoodSnapshot`. */
	food: json('food').notNull().default({}),
	/** `Serving`: `{ measure, quantity }`. */
	serving: json('serving').notNull().default({}),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
});

/** A saved snapshot of a food at a chosen serving. Several may come from one food. */
export const foodFavorites = sqliteTable('food_favorites', {
	id: text('id').primaryKey(),
	food: json('food').notNull().default({}),
	serving: json('serving').notNull().default({}),
	createdAt: text('created_at').notNull(),
});

/** What the owner said about a day. The id is the day; a day without a row is a plain logged day. */
export const nutritionDays = sqliteTable('nutrition_days', {
	id: text('id').primaryKey(),
	status: text('status', { enum: DAY_STATUSES }).notNull().default('none'),
	/** Sparse nutrients that replace the log's totals for this day, or null to use the log. */
	override: json('override'),
});

/** A titled note on a day of the food log, at a time; MacroFactor allows five a day. */
export const foodLogNotes = sqliteTable('food_log_notes', {
	id: text('id').primaryKey(),
	day: text('day').notNull(),
	minute: integer('minute').notNull().default(720),
	title: text('title').notNull(),
	body: text('body').notNull().default(''),
	color: text('color', { enum: NOTE_COLORS }).notNull().default('blue'),
});

/** A manual visual body fat, tape measurement, or step count for a day. The id is `<day>/<kind>`, so one value per day. */
export const bodyMetrics = sqliteTable('body_metrics', {
	id: text('id').primaryKey(),
	day: text('day').notNull(),
	kind: text('kind', { enum: BODY_METRIC_KINDS }).notNull(),
	/** Percent for `visual_body_fat`, a count for `steps`, centimeters for the rest. */
	value: real('value').notNull(),
	updatedAt: text('updated_at').notNull(),
});

/**
 * The nutrition strategy from a day on: the goal, the coaching program, and the seven day targets, which apply until
 * the next plan's day. The id is that first day, so a second plan on one day replaces the first. A check-in freezes
 * the expenditure and trend weight it used here; every other series is recomputed from the log and the weigh-ins.
 */
export const nutritionPlans = sqliteTable('nutrition_plans', {
	id: text('id').primaryKey(),
	kind: text('kind', { enum: PLAN_KINDS }).notNull().default('edit'),
	/** `NutritionGoal`. */
	goal: json('goal').notNull().default({}),
	/** `CoachingProgram`. */
	coaching: json('coaching').notNull().default({}),
	/** `[DayTarget]`, seven, Monday first. */
	targets: json('targets').notNull().default([]),
	expenditureKcal: real('expenditure_kcal'),
	trendWeightKg: real('trend_weight_kg'),
	createdAt: text('created_at').notNull(),
});

/**
 * A micronutrient's floor, target, and ceiling from a day on. The id is `<day>/<nutrient>`. `auto` takes the
 * registry's defaults and ignores the three bounds, `none` shows no bounds, and a null bound under `custom` hides that
 * bound.
 */
export const nutrientGoals = sqliteTable('nutrient_goals', {
	id: text('id').primaryKey(),
	nutrient: text('nutrient').notNull(),
	startsOn: text('starts_on').notNull(),
	mode: text('mode', { enum: NUTRIENT_GOAL_MODES }).notNull().default('auto'),
	floor: real('floor'),
	target: real('target'),
	ceiling: real('ceiling'),
});

/** The order here is the order of the generated Swift schema and of a snapshot pull. */
export const SYNCED_TABLES = {
	workout_templates: workoutTemplates,
	workout_sessions: workoutSessions,
	custom_exercises: customExercises,
	exercise_settings: exerciseSettings,
	settings,
	programs,
	gym_profiles: gymProfiles,
	body_weights: bodyWeights,
	api_tokens: apiTokens,
	foods,
	recipes,
	food_entries: foodEntries,
	food_favorites: foodFavorites,
	nutrition_days: nutritionDays,
	food_log_notes: foodLogNotes,
	body_metrics: bodyMetrics,
	nutrition_plans: nutritionPlans,
	nutrient_goals: nutrientGoals,
} as const;

export type SyncedTable = keyof typeof SYNCED_TABLES;

const array = z.array(z.unknown());
const object = z.record(z.string(), z.unknown());
const count = z.int().min(0);
const atLeastOne = z.int().min(1);
const positive = z.number().positive();
const amount = z.number().nonnegative();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** A nutrient registry id: a letter id (`k`, `nc`) or a three-digit USDA number. Not the registry's list itself, so a
 * nutrient a newer app adds needs no server deploy. */
const nutrientID = z.string().regex(/^([a-z]{1,2}|\d{3})$/);

/**
 * The inner shapes of the nutrition data columns, as the Swift encoder writes them. The app's decoders are strict, so a
 * tree they cannot read would hide its row; checking it here refuses the write instead. Objects are not strict: a key
 * from an app a version ahead passes.
 */
export const nutrientAmounts = z.record(nutrientID, amount);
/** `quantity` of this measure is `servings` base servings: `{ name: 'cup', quantity: 1, servings: 2.4 }`. */
const measure = z.object({ name: z.string().min(1), quantity: positive, servings: positive });
export const serving = z.object({ measure, quantity: positive });
export const foodNutrition = z.object({
	nutrients: nutrientAmounts,
	baseGrams: positive.optional(),
	baseMilliliters: positive.optional(),
	measures: z.array(measure).min(1),
});
export const foodSnapshot = z.object({
	foodID: z.string().optional(),
	source: z.enum(FOOD_SOURCES),
	name: z.string().min(1),
	brand: z.string().optional(),
	icon: z.string().optional(),
	nutrition: foodNutrition,
});
const minute = z.int().min(0).max(1439);
const recipeIngredient = z.object({ id: z.string(), food: foodSnapshot, serving });
const dayTarget = z.object({ energy: amount, protein: amount, fat: amount, carbs: amount });
const nutritionGoal = z.object({
	kind: z.enum(GOAL_KINDS),
	targetWeightKg: positive.optional(),
	ratePercentPerWeek: z.number(),
	startedOn: day,
});
const coachingProgram = z.object({
	style: z.enum(PROGRAM_STYLES),
	diet: z.enum(DIET_STYLES),
	protein: z.enum(PROTEIN_LEVELS),
	floor: z.enum(CALORIE_FLOORS),
	training: z.enum(TRAINING_TYPES),
	/** ISO weekdays, Monday 1, that get more calories. Empty spreads them evenly. */
	highDays: z.array(z.int().min(1).max(7)),
});

/**
 * What the Postgres check constraints refused, now run by the engine per column before a write lands. A check that
 * related two columns (a session's program with its day and cycle) is gone: two devices can patch them separately, so
 * the reader tolerates a half-set trio, as it already does for `cycles` and `current_cycle`.
 */
export const schema = defineSchema({
	tables: SYNCED_TABLES,
	values: {
		workout_templates: { blocks: array },
		workout_sessions: { blocks: array, cycle: atLeastOne, pausedSeconds: count },
		custom_exercises: { id: z.string().startsWith('custom-'), exercise: object },
		exercise_settings: { restSeconds: count, overrides: object },
		settings: {
			id: z.literal('settings'),
			weightUnit: z.enum(WEIGHT_UNITS),
			restCompoundUpper: count,
			restCompoundLower: count,
			restUpperIsolation: count,
			restLowerIsolation: count,
			restCore: count,
			workout: object,
			profile: object,
			dashboard: object,
			shortcuts: object,
			nutrition: object,
		},
		programs: { cycles: atLeastOne, currentCycle: atLeastOne, config: object, days: array },
		gym_profiles: { equipment: object },
		body_weights: {
			weightKg: z.number().positive(),
			source: z.enum(BODY_WEIGHT_SOURCES),
			bodyFatPercent: z.number().min(0).max(100),
		},
		api_tokens: { tokenHash: z.string().regex(/^[0-9a-f]{64}$/) },
		foods: { source: z.enum(FOOD_ROW_SOURCES), name: z.string().min(1), nutrition: foodNutrition },
		recipes: {
			name: z.string().min(1),
			ingredients: z.array(recipeIngredient),
			servings: positive,
			cookedGrams: positive,
			steps: z.array(z.string()),
			prepMinutes: count,
			cookMinutes: count,
		},
		food_entries: { day, minute, food: foodSnapshot, serving },
		food_favorites: { food: foodSnapshot, serving },
		nutrition_days: { status: z.enum(DAY_STATUSES), override: nutrientAmounts },
		food_log_notes: { day, minute, title: z.string().min(1), color: z.enum(NOTE_COLORS) },
		body_metrics: { day, kind: z.enum(BODY_METRIC_KINDS), value: amount },
		nutrition_plans: {
			kind: z.enum(PLAN_KINDS),
			goal: nutritionGoal,
			coaching: coachingProgram,
			targets: z.array(dayTarget).length(7),
			expenditureKcal: positive,
			trendWeightKg: positive,
		},
		nutrient_goals: {
			nutrient: nutrientID,
			startsOn: day,
			mode: z.enum(NUTRIENT_GOAL_MODES),
			floor: amount,
			target: amount,
			ceiling: amount,
		},
	},
});
