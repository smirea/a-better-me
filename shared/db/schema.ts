import { sql } from 'drizzle-orm';
import { boolean, check, doublePrecision, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * The server's Postgres database, which PowerSync streams to the owner's devices. Each table mirrors a Swift model in
 * `app-ios/Sources/App/Workouts/Model/`: ids are client-made, ordered trees stay one `jsonb` column as in SwiftData,
 * and timestamps are `timestamptz`, which the device writes as ISO 8601 text. Column defaults are what a put that
 * leaves a column out gets, since PowerSync omits null columns from a put.
 */

const instant = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

export const SETTINGS_ID = 'settings';
export const WEIGHT_UNITS = ['kg', 'lb'] as const;
export const BODY_WEIGHT_SOURCES = ['manual', 'healthkit'] as const;

export const workoutTemplates = pgTable(
	'workout_templates',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		notes: text('notes').notNull().default(''),
		/** `[WorkoutBlock]`, the ordered block tree a session copies when it starts from this template. */
		blocks: jsonb('blocks').notNull().default([]),
		createdAt: instant('created_at').notNull(),
		updatedAt: instant('updated_at').notNull(),
		/** The program this template is a day of. Not a foreign key, like `template_id`. */
		programId: text('program_id'),
		gymId: text('gym_id'),
		archived: boolean('archived').notNull().default(false),
	},
	table => [check('workout_templates_blocks_array', sql`jsonb_typeof(${table.blocks}) = 'array'`)],
);

export const workoutSessions = pgTable(
	'workout_sessions',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		/** The template it started from. Not a foreign key: deleting a template keeps its history. */
		templateId: text('template_id'),
		startedAt: instant('started_at').notNull(),
		/** Null while the workout is in progress. */
		endedAt: instant('ended_at'),
		notes: text('notes').notNull().default(''),
		blocks: jsonb('blocks').notNull().default([]),
		programId: text('program_id'),
		/** `ProgramDay.id` inside the program's `days`. */
		programDayId: text('program_day_id'),
		cycle: integer('cycle'),
		gymId: text('gym_id'),
		pausedSeconds: integer('paused_seconds').notNull().default(0),
	},
	table => [
		check('workout_sessions_blocks_array', sql`jsonb_typeof(${table.blocks}) = 'array'`),
		check(
			'workout_sessions_program',
			sql`(${table.programId} IS NULL) = (${table.programDayId} IS NULL) AND (${table.programDayId} IS NULL) = (${table.cycle} IS NULL)`,
		),
		check('workout_sessions_cycle', sql`${table.cycle} >= 1`),
		check('workout_sessions_paused_seconds', sql`${table.pausedSeconds} >= 0`),
	],
);

export const customExercises = pgTable(
	'custom_exercises',
	{
		id: text('id').primaryKey(),
		/** The whole `Exercise`, as the app encodes it. */
		exercise: jsonb('exercise').notNull(),
		isArchived: boolean('is_archived').notNull().default(false),
	},
	table => [
		check('custom_exercises_id_prefix', sql`${table.id} LIKE 'custom-%'`),
		check('custom_exercises_exercise_object', sql`jsonb_typeof(${table.exercise}) = 'object'`),
	],
);

/** Keyed by the exercise's ID, so two devices editing one exercise's settings offline converge on one row. */
export const exerciseSettings = pgTable(
	'exercise_settings',
	{
		id: text('id').primaryKey(),
		pinnedNote: text('pinned_note').notNull().default(''),
		restSeconds: integer('rest_seconds'),
		doNotRecommend: boolean('do_not_recommend').notNull().default(false),
		/** `ExerciseOverrides`: every key optional, `{}` is all defaults. */
		overrides: jsonb('overrides').notNull().default({}),
	},
	table => [
		check('exercise_settings_rest_seconds', sql`${table.restSeconds} >= 0`),
		check('exercise_settings_overrides_object', sql`jsonb_typeof(${table.overrides}) = 'object'`),
	],
);

/** One row with the id `settings`. The rest defaults are `RestCategory.defaultSeconds`. */
export const settings = pgTable(
	'settings',
	{
		id: text('id').primaryKey(),
		weightUnit: text('weight_unit', { enum: WEIGHT_UNITS }).notNull().default('kg'),
		restCompoundUpper: integer('rest_compound_upper').notNull().default(120),
		restCompoundLower: integer('rest_compound_lower').notNull().default(180),
		restUpperIsolation: integer('rest_upper_isolation').notNull().default(90),
		restLowerIsolation: integer('rest_lower_isolation').notNull().default(90),
		restCore: integer('rest_core').notNull().default(60),
		/** `WorkoutSettings`, `ProfileSettings`, `DashboardLayout`, `ShortcutsLayout`: each rewritten whole by the app. */
		workout: jsonb('workout').notNull().default({}),
		profile: jsonb('profile').notNull().default({}),
		dashboard: jsonb('dashboard').notNull().default({}),
		shortcuts: jsonb('shortcuts').notNull().default({}),
	},
	table => [
		check('settings_id', sql`${table.id} = 'settings'`),
		check('settings_weight_unit', sql`${table.weightUnit} IN ('kg', 'lb')`),
		check(
			'settings_rest_seconds',
			sql`LEAST(${table.restCompoundUpper}, ${table.restCompoundLower}, ${table.restUpperIsolation}, ${table.restLowerIsolation}, ${table.restCore}) >= 0`,
		),
		check(
			'settings_json_objects',
			sql`jsonb_typeof(${table.workout}) = 'object' AND jsonb_typeof(${table.profile}) = 'object' AND jsonb_typeof(${table.dashboard}) = 'object' AND jsonb_typeof(${table.shortcuts}) = 'object'`,
		),
	],
);

export const programs = pgTable(
	'programs',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		color: text('color').notNull(),
		icon: text('icon').notNull(),
		cycles: integer('cycles').notNull(),
		currentCycle: integer('current_cycle').notNull().default(1),
		/** At most one program is meant to be active. The app keeps it so (`LocalStore.activateProgram`); no index enforces it. */
		active: boolean('active').notNull().default(false),
		archived: boolean('archived').notNull().default(false),
		config: jsonb('config').notNull().default({}),
		/** `[ProgramDay]`, in cycle order: `{ id, templateID? }`, a rest day without `templateID`. */
		days: jsonb('days').notNull().default([]),
		createdAt: instant('created_at').notNull(),
		updatedAt: instant('updated_at').notNull(),
	},
	table => [
		check('programs_cycles', sql`${table.cycles} >= 1 AND ${table.currentCycle} >= 1`),
		check('programs_config_object', sql`jsonb_typeof(${table.config}) = 'object'`),
		check('programs_days_array', sql`jsonb_typeof(${table.days}) = 'array'`),
	],
);

export const gymProfiles = pgTable(
	'gym_profiles',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		icon: text('icon').notNull(),
		isDefault: boolean('is_default').notNull().default(false),
		/** `{ [equipmentId]: GymEquipment }`, the selected items and their weight overrides. */
		equipment: jsonb('equipment').notNull().default({}),
		createdAt: instant('created_at').notNull(),
		updatedAt: instant('updated_at').notNull(),
	},
	table => [check('gym_profiles_equipment_object', sql`jsonb_typeof(${table.equipment}) = 'object'`)],
);

export const bodyWeights = pgTable(
	'body_weights',
	{
		id: text('id').primaryKey(),
		measuredAt: instant('measured_at').notNull(),
		weightKg: doublePrecision('weight_kg').notNull(),
		source: text('source', { enum: BODY_WEIGHT_SOURCES }).notNull().default('manual'),
	},
	table => [
		check('body_weights_weight_kg', sql`${table.weightKg} > 0`),
		check('body_weights_source', sql`${table.source} IN ('manual', 'healthkit')`),
	],
);

/** What PowerSync replicates, by table name. The `powersync` publication and the sync config name the same tables. */
export const SYNCED_TABLES = {
	workout_templates: workoutTemplates,
	workout_sessions: workoutSessions,
	custom_exercises: customExercises,
	exercise_settings: exerciseSettings,
	settings,
	programs,
	gym_profiles: gymProfiles,
	body_weights: bodyWeights,
} as const;

export type SyncedTable = keyof typeof SYNCED_TABLES;
