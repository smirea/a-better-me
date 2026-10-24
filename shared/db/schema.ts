import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { defineSchema } from 'sync-engine/core';
import { z } from 'zod';

/**
 * The synced tables, one SQLite schema that the server's space and every device run as the same DDL. Each table
 * mirrors a Swift model in `app-ios/Sources/App/Workouts/Model/`: ids are client-made, ordered trees stay one JSON
 * column, and instants are ISO 8601 UTC text with milliseconds. A column default is what a put that leaves the column
 * out gets, so every column added later needs a default or must be nullable.
 */

const json = (name: string) => text(name, { mode: 'json' });
const bool = (name: string) => integer(name, { mode: 'boolean' });

export const SETTINGS_ID = 'settings';
export const WEIGHT_UNITS = ['kg', 'lb'] as const;
export const BODY_WEIGHT_SOURCES = ['manual', 'healthkit'] as const;

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
} as const;

export type SyncedTable = keyof typeof SYNCED_TABLES;

const array = z.array(z.unknown());
const object = z.record(z.string(), z.unknown());
const count = z.int().min(0);
const atLeastOne = z.int().min(1);

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
		},
		programs: { cycles: atLeastOne, currentCycle: atLeastOne, config: object, days: array },
		gym_profiles: { equipment: object },
		body_weights: { weightKg: z.number().positive(), source: z.enum(BODY_WEIGHT_SOURCES) },
	},
});
