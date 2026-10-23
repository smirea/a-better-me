import { sql } from 'drizzle-orm';
import { boolean, check, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * The server's Postgres database, which PowerSync streams to the owner's devices. Each table mirrors a Swift model in
 * `app-ios/Sources/App/Workouts/Model/`: ids are client-made, ordered trees stay one `jsonb` column as in SwiftData,
 * and timestamps are `timestamptz`, which the device writes as ISO 8601 text. Column defaults are what a put that
 * leaves a column out gets, since PowerSync omits null columns from a put.
 */

const instant = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

export const SETTINGS_ID = 'settings';
export const WEIGHT_UNITS = ['kg', 'lb'] as const;

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
	},
	table => [check('workout_sessions_blocks_array', sql`jsonb_typeof(${table.blocks}) = 'array'`)],
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
	},
	table => [check('exercise_settings_rest_seconds', sql`${table.restSeconds} >= 0`)],
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
	},
	table => [
		check('settings_id', sql`${table.id} = 'settings'`),
		check('settings_weight_unit', sql`${table.weightUnit} IN ('kg', 'lb')`),
		check(
			'settings_rest_seconds',
			sql`LEAST(${table.restCompoundUpper}, ${table.restCompoundLower}, ${table.restUpperIsolation}, ${table.restLowerIsolation}, ${table.restCore}) >= 0`,
		),
	],
);

/** What PowerSync replicates, by table name. The `powersync` publication and the sync config name the same tables. */
export const SYNCED_TABLES = {
	workout_templates: workoutTemplates,
	workout_sessions: workoutSessions,
	custom_exercises: customExercises,
	exercise_settings: exerciseSettings,
	settings,
} as const;

export type SyncedTable = keyof typeof SYNCED_TABLES;
