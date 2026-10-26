import { z } from 'zod';
import { SETTINGS_ID } from '../../../shared/db/schema';
import { CATALOG_EXERCISES, catalogExercise, EQUIPMENT, EQUIPMENT_BY_ID, type Exercise } from './catalog';
import { ApiError, type Db, type RowOf } from './db';
import * as M from './models';

export type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
type Context<Query, Body> = { db: Db; params: Record<string, string>; query: Query; body: Body; now: string };

/** One operation: the router dispatches on it and the OpenAPI document is generated from it, so the two never drift. */
export type Route = {
	method: Method;
	path: string;
	tag: string;
	summary: string;
	description?: string;
	query?: z.ZodObject;
	body?: z.ZodType;
	response: z.ZodType;
	run(context: Context<any, any>): unknown;
};

function route<Query extends z.ZodObject = z.ZodObject<{}>, Body extends z.ZodType = z.ZodUndefined>(
	definition: Omit<Route, 'run' | 'query' | 'body'> & {
		query?: Query;
		body?: Body;
		run(context: Context<z.output<Query>, z.output<Body>>): unknown;
	},
): Route {
	return definition as Route;
}

type TemplateRow = RowOf<'workout_templates'>;
type SessionRow = RowOf<'workout_sessions'>;
type ProgramRow = RowOf<'programs'>;
type ProgramDay = z.output<typeof M.ProgramDay>;
type Config = z.output<typeof M.ProgramConfig>;

const flag = z.stringbool();
const limit = (fallback: number, max: number) => z.coerce.number().int().min(1).max(max).default(fallback);
const offset = z.coerce.number().int().min(0).default(0);
const sameId = (a: string | null | undefined, b: string | null | undefined) =>
	!!a && a.toLowerCase() === b?.toLowerCase();

function where(conditions: [string, ...(string | number)[]][]): [string | undefined, (string | number)[]] {
	if (!conditions.length) return [undefined, []];
	return [conditions.map(([sql]) => sql).join(' AND '), conditions.flatMap(([, ...params]) => params)];
}

function forEachSet(blocks: M.Blocks, visit: (set: { log?: z.output<typeof M.SetLog> }) => void) {
	for (const block of blocks) {
		for (const exercise of block.exercises) {
			for (const set of [...exercise.sets, ...(exercise.cycleTargets ?? []).flatMap(cycle => cycle.sets)]) {
				visit(set);
				set.subSets.forEach(visit);
			}
		}
	}
}

/** Swift's `SetLog.completedAt` is required, so a log without one gets the moment the workout ended. */
function stampLogs(blocks: M.Blocks, at: string): M.Blocks {
	forEachSet(blocks, set => {
		if (set.log && !set.log.completedAt) set.log.completedAt = at;
	});
	return blocks;
}

/** Templates hold plans. The app decodes `SetLog.completedAt` strictly, so a log there would hide the template. */
function assertNoLogs(blocks: M.Blocks | undefined) {
	let logged = false;
	forEachSet(blocks ?? [], set => {
		logged ||= !!set.log;
	});
	if (logged) throw new ApiError(400, 'Template sets take `target`, not `log`. Log done sets on a session.');
}

/** `DeloadRule.apply`: one set fewer, 80% of the reps, three more RIR. */
function deload(sets: z.output<typeof M.WorkoutSet>[]) {
	return (sets.length > 1 ? sets.slice(0, -1) : sets).map(({ log: _, ...set }) => ({
		...set,
		...(set.target && {
			target: {
				...set.target,
				...(set.target.repsMin !== undefined && { repsMin: Math.round(set.target.repsMin * 0.8) }),
				...(set.target.repsMax !== undefined && { repsMax: Math.round(set.target.repsMax * 0.8) }),
				...(set.target.rir !== undefined && { rir: Math.min(set.target.rir + 3, 6) }),
			},
		}),
	}));
}

/**
 * `Program.blocks(of:cycle:)`: a program template as `cycle` trains it. Cycle targets are training weeks; the deload
 * cycle is derived from the week beside it, and skipped exercises drop out.
 */
function blocksForCycle(row: ReturnType<typeof program>, blocks: M.Blocks, cycle: number): M.Blocks {
	const { deload: rule } = row.config;
	const isDeload = (rule === 'firstCycle' && cycle === 1) || (rule === 'lastCycle' && cycle === row.cycles + 1);
	const week = isDeload ? (rule === 'firstCycle' ? 1 : row.cycles) : rule === 'firstCycle' ? cycle - 1 : cycle;
	return blocks.flatMap(block => {
		const exercises = block.exercises.flatMap(({ cycleTargets, ...exercise }) => {
			const entry = cycleTargets?.[week - 1];
			if (entry?.skip) return [];
			const sets = entry?.sets ?? exercise.sets;
			return [{ ...exercise, sets: isDeload ? deload(sets) : sets }];
		});
		return exercises.length ? [{ ...block, exercises }] : [];
	});
}

function customExercises(db: Db) {
	return db.all('custom_exercises').map(row => ({
		...(row.exercise as Exercise),
		custom: true,
		archived: row.isArchived,
	}));
}

function findExercise(db: Db, id: string) {
	const catalog = catalogExercise(id);
	if (catalog) return { ...catalog, custom: false, archived: false };
	const row = db.get('custom_exercises', id);
	if (!row) throw new ApiError(404, `No exercise with id ${id}`);
	return { ...(row.exercise as Exercise), custom: true, archived: row.isArchived };
}

function assertExercises(db: Db, blocks: M.Blocks | undefined) {
	const ids = new Set(blocks?.flatMap(block => block.exercises.map(exercise => exercise.exerciseID)));
	const unknown = [...ids].filter(id => !catalogExercise(id) && !db.get('custom_exercises', id));
	if (unknown.length)
		throw new ApiError(422, `Unknown exercise ids: ${unknown.join(', ')}. Look them up in GET /exercises.`);
}

function assertEquipment(ids: Iterable<string>) {
	const unknown = [...ids].filter(id => !EQUIPMENT_BY_ID.has(id));
	if (unknown.length) throw new ApiError(422, `Unknown equipment ids: ${unknown.join(', ')}. See GET /equipment.`);
}

function assertGym(db: Db, gymId: string | null | undefined) {
	if (gymId) db.find('gym_profiles', gymId.toLowerCase(), 'gym');
}

const slimKeys = Object.keys(M.Exercise.shape);
const slim = (exercise: Record<string, unknown>) =>
	Object.fromEntries(slimKeys.map(key => [key, exercise[key] ?? (key === 'region' ? null : [])]));

const optionNames = (options: string[][]) =>
	options.map(ids => ids.map(id => EQUIPMENT_BY_ID.get(id)?.name ?? id).join(' and '));

function exerciseSettings(db: Db, id: string): z.output<typeof M.ExerciseSettings> {
	const row = db.get('exercise_settings', id);
	return {
		pinnedNote: row?.pinnedNote ?? '',
		restSeconds: row?.restSeconds ?? null,
		doNotRecommend: row?.doNotRecommend ?? false,
	};
}

/** Day ids and template ids lowercase, so they compare equal to row ids and a session's `programDayId`. */
function program(row: ProgramRow) {
	const days = (row.days as ProgramDay[]).map(day => ({
		...day,
		id: day.id.toLowerCase(),
		...(day.templateID && { templateID: day.templateID.toLowerCase() }),
	}));
	return { ...row, days, config: row.config as Config };
}

/**
 * `Program.nextDay`: the first day in order not done in the current cycle of the current run. A workout day is done
 * by a finished session of it since `runStartedAt`, a rest day by its tick, so last run's sessions never count.
 */
function upNext(row: ReturnType<typeof program>, sessions: SessionRow[]) {
	const since = row.config.runStartedAt ?? '';
	const done = new Set(
		sessions
			.filter(s => s.endedAt && sameId(s.programId, row.id) && s.cycle === row.currentCycle && s.startedAt >= since)
			.map(s => s.programDayId?.toLowerCase()),
	);
	const next = row.days.find(day => (day.templateID ? !done.has(day.id) : day.restDoneInCycle !== row.currentCycle));
	return next ? { dayId: next.id, templateId: next.templateID ?? null, cycle: row.currentCycle } : null;
}

function programDetail(db: Db, row: ProgramRow) {
	const shaped = program(row);
	const ids = new Set(shaped.days.flatMap(day => (day.templateID ? [day.templateID] : [])));
	const templates = db.all('workout_templates').filter(t => ids.has(t.id.toLowerCase()) || sameId(t.programId, row.id));
	return { ...shaped, templates, upNext: upNext(shaped, db.all('workout_sessions', 'program_id = ?', [row.id])) };
}

type DayInput = z.output<typeof M.ProgramCreate>['days'][number];

/** Turns day inputs into stored days, creating inline templates. An existing day keeps its rest-day tick. */
function resolveDays(db: Db, inputs: DayInput[], programId: string, previous: ProgramDay[], now: string) {
	const changes: ReturnType<Db['put']>[] = [];
	const days = inputs.map((input): ProgramDay => {
		const kept = input.id ? previous.find(day => sameId(day.id, input.id)) : undefined;
		const id = (input.id ?? M.newId()).toLowerCase();
		const restDone = kept?.restDoneInCycle === undefined ? {} : { restDoneInCycle: kept.restDoneInCycle };
		if (input.template) {
			assertExercises(db, input.template.blocks);
			assertNoLogs(input.template.blocks);
			assertGym(db, input.template.gymId);
			const template: TemplateRow = {
				id: M.newId(),
				...input.template,
				programId,
				createdAt: now,
				updatedAt: now,
			};
			changes.push(db.put('workout_templates', template));
			return { id, templateID: template.id, ...restDone };
		}
		if (input.templateId) {
			db.find('workout_templates', input.templateId.toLowerCase(), 'template');
			return { id, templateID: input.templateId.toLowerCase(), ...restDone };
		}
		return { id, ...restDone };
	});
	return { days, changes };
}

/** `LocalStore.activate` and `activateProgram`: a fresh run from cycle 1, and every other program inactive. */
function activation(db: Db, row: ProgramRow, now: string) {
	const others = db.all('programs', 'active = 1 AND id != ?', [row.id]);
	return [
		db.patch('programs', row.id, {
			active: true,
			archived: false,
			currentCycle: 1,
			config: { ...(row.config as Config), runStartedAt: now },
			days: (row.days as ProgramDay[]).map(({ restDoneInCycle: _, ...day }) => day),
			updatedAt: now,
		}),
		...others.map(other => db.patch('programs', other.id, { active: false, updatedAt: now })),
	];
}

function settings(db: Db): z.output<typeof M.Settings> {
	const row = db.get('settings', SETTINGS_ID);
	// The app reads a missing row as pounds, unlike the column default.
	return {
		weightUnit: row?.weightUnit ?? 'lb',
		rest: {
			compoundUpper: row?.restCompoundUpper ?? 120,
			compoundLower: row?.restCompoundLower ?? 180,
			upperIsolation: row?.restUpperIsolation ?? 90,
			lowerIsolation: row?.restLowerIsolation ?? 90,
			core: row?.restCore ?? 60,
		},
		workout: (row?.workout as Record<string, unknown>) ?? {},
		profile: (row?.profile as Record<string, unknown>) ?? {},
		dashboard: (row?.dashboard as Record<string, unknown>) ?? {},
		shortcuts: (row?.shortcuts as Record<string, unknown>) ?? {},
	};
}

function hasEquipment(gym: Record<string, unknown>, exercise: Exercise) {
	const has = (options: string[][]) => !options.length || options.some(ids => ids.every(id => id in gym));
	return has(exercise.resistanceEquipmentIDs) && has(exercise.supportEquipmentIDs);
}

const id = (context: { params: Record<string, string> }) => context.params.id!;

export const routes: Route[] = [
	route({
		method: 'GET',
		path: '/exercises',
		tag: 'Exercises',
		summary: 'Search the exercise catalog and custom exercises',
		description: 'Slim records. GET /exercises/{id} has every field, including instructions metadata and settings.',
		query: z.object({
			q: z.string().optional().meta({ description: 'Matches the name or an alternative name, case-insensitively.' }),
			muscle: z.enum(M.MUSCLES).optional().meta({ description: 'A primary muscle.' }),
			type: z.enum(M.EXERCISE_TYPES).optional(),
			category: z.enum(M.EXERCISE_CATEGORIES).optional(),
			equipmentId: z.string().optional().meta({ description: 'Exercises with an option that uses this equipment.' }),
			gymId: z.guid().optional().meta({ description: "Only exercises this gym's equipment allows." }),
			custom: flag.optional(),
			includeArchived: flag.default(false),
			limit: limit(50, 500),
			offset,
		}),
		response: z.object({ total: z.int(), items: z.array(M.Exercise) }),
		run({ db, query }) {
			const gym =
				query.gymId && (db.find('gym_profiles', query.gymId.toLowerCase(), 'gym').equipment as Record<string, unknown>);
			const needle = query.q?.toLowerCase();
			const matches = [
				...CATALOG_EXERCISES.map(e => ({ ...e, custom: false, archived: false })),
				...customExercises(db),
			].filter(
				e =>
					(query.includeArchived || !e.archived) &&
					(query.custom === undefined || e.custom === query.custom) &&
					(!needle || [e.name, ...e.alternativeNames].some(name => name.toLowerCase().includes(needle))) &&
					(!query.muscle || e.primaryMuscles.includes(query.muscle)) &&
					(!query.type || e.type === query.type) &&
					(!query.category || e.category === query.category) &&
					(!query.equipmentId ||
						[...e.resistanceEquipmentIDs, ...e.supportEquipmentIDs].some(ids => ids.includes(query.equipmentId!))) &&
					(!gym || hasEquipment(gym, e)),
			);
			return { total: matches.length, items: matches.slice(query.offset, query.offset + query.limit).map(slim) };
		},
	}),
	route({
		method: 'GET',
		path: '/exercises/{id}',
		tag: 'Exercises',
		summary: 'Get an exercise with its settings',
		response: M.ExerciseDetail,
		run: context => ({ ...findExercise(context.db, id(context)), settings: exerciseSettings(context.db, id(context)) }),
	}),
	route({
		method: 'GET',
		path: '/exercises/{id}/history',
		tag: 'Exercises',
		summary: 'Every finished session that trained the exercise, with its sets',
		description: 'The input for progression: weights, reps, and RIR per set, newest session first.',
		query: z.object({ limit: limit(10, 200) }),
		response: M.ExerciseHistory,
		run({ db, params, query }) {
			findExercise(db, params.id!);
			const sessions = db.all(
				'workout_sessions',
				'ended_at IS NOT NULL AND instr(blocks, ?) > 0 ORDER BY started_at DESC LIMIT ?',
				[`"exerciseID":${JSON.stringify(params.id)}`, query.limit],
			);
			return sessions.map(session => {
				const exercises = (session.blocks as M.Blocks)
					.flatMap(b => b.exercises)
					.filter(e => e.exerciseID === params.id);
				return {
					sessionId: session.id,
					sessionName: session.name,
					startedAt: session.startedAt,
					note: exercises.find(e => e.note)?.note ?? null,
					sets: exercises.flatMap(e => e.sets),
				};
			});
		},
	}),
	route({
		method: 'POST',
		path: '/exercises',
		tag: 'Exercises',
		summary: 'Create a custom exercise',
		body: M.ExerciseCreate,
		response: M.ExerciseDetail,
		run({ db, body }) {
			assertEquipment([...body.resistanceEquipmentIDs, ...body.supportEquipmentIDs].flat());
			const exercise = {
				id: `custom-${M.newId()}`,
				primaryMuscleDetails: [],
				secondaryMuscleDetails: [],
				movementPatterns: [],
				primaryJointActions: [],
				secondaryJointActions: [],
				searchBoost: 0,
				hasInstructions: false,
				articleIDs: [],
				images: [],
				...body,
				resistanceEquipment: optionNames(body.resistanceEquipmentIDs),
				supportEquipment: optionNames(body.supportEquipmentIDs),
				equipmentIDs: [...new Set([...body.resistanceEquipmentIDs, ...body.supportEquipmentIDs].flat())],
			};
			db.commit(db.put('custom_exercises', { id: exercise.id, exercise, isArchived: false }));
			return { ...exercise, custom: true, archived: false, settings: exerciseSettings(db, exercise.id) };
		},
	}),
	route({
		method: 'PATCH',
		path: '/exercises/{id}',
		tag: 'Exercises',
		summary: 'Edit or archive a custom exercise',
		description: 'Catalog exercises are read-only; PATCH /exercises/{id}/settings changes how they behave.',
		body: M.ExercisePatch,
		response: M.ExerciseDetail,
		run({ db, params, body }) {
			const row = db.get('custom_exercises', params.id!);
			if (!row) throw new ApiError(catalogExercise(params.id!) ? 403 : 404, `${params.id} is not a custom exercise`);
			const { archived, ...changes } = body;
			const exercise = { ...(row.exercise as Exercise), ...changes };
			if (changes.resistanceEquipmentIDs || changes.supportEquipmentIDs) {
				assertEquipment([...exercise.resistanceEquipmentIDs, ...exercise.supportEquipmentIDs].flat());
				Object.assign(exercise, {
					resistanceEquipment: optionNames(exercise.resistanceEquipmentIDs),
					supportEquipment: optionNames(exercise.supportEquipmentIDs),
					equipmentIDs: [...new Set([...exercise.resistanceEquipmentIDs, ...exercise.supportEquipmentIDs].flat())],
				});
			}
			db.commit(
				db.patch('custom_exercises', row.id, { exercise, ...(archived !== undefined && { isArchived: archived }) }),
			);
			return { ...findExercise(db, row.id), settings: exerciseSettings(db, row.id) };
		},
	}),
	route({
		method: 'DELETE',
		path: '/exercises/{id}',
		tag: 'Exercises',
		summary: 'Delete a custom exercise',
		description: 'Its logged sets stay in history and show as "Unknown exercise". Prefer archiving.',
		response: M.Deleted,
		run({ db, params }) {
			db.find('custom_exercises', params.id!, 'custom exercise');
			db.commit(db.delete('custom_exercises', params.id!));
			return { deleted: params.id! };
		},
	}),
	route({
		method: 'PATCH',
		path: '/exercises/{id}/settings',
		tag: 'Exercises',
		summary: "Set an exercise's pinned note, rest override, or Do Not Recommend",
		body: M.ExerciseSettingsPatch,
		response: M.ExerciseSettings,
		run({ db, params, body }) {
			findExercise(db, params.id!);
			const existing = db.get('exercise_settings', params.id!);
			db.commit(
				existing
					? db.patch('exercise_settings', params.id!, body)
					: db.put('exercise_settings', {
							id: params.id!,
							overrides: {},
							...exerciseSettings(db, params.id!),
							...body,
						}),
			);
			return exerciseSettings(db, params.id!);
		},
	}),
	route({
		method: 'GET',
		path: '/equipment',
		tag: 'Exercises',
		summary: 'The equipment catalog, for gym equipment and exercise options',
		query: z.object({ q: z.string().optional(), category: z.string().optional() }),
		response: z.array(M.Equipment),
		run: ({ query }) =>
			EQUIPMENT.filter(
				item =>
					(!query.q || item.name.toLowerCase().includes(query.q.toLowerCase())) &&
					(!query.category || item.category === query.category),
			),
	}),

	route({
		method: 'GET',
		path: '/templates',
		tag: 'Templates',
		summary: 'List workout templates',
		query: z.object({
			programId: z.guid().optional().meta({ description: "Only this program's days." }),
			library: flag
				.optional()
				.meta({ description: 'true: only templates outside programs. false: only program days.' }),
			archived: flag.optional(),
		}),
		response: z.array(M.Template),
		run({ db, query }) {
			const conditions: [string, ...(string | number)[]][] = [];
			if (query.programId) conditions.push(['program_id = ?', query.programId.toLowerCase()]);
			if (query.library !== undefined) conditions.push([`program_id IS ${query.library ? '' : 'NOT '}NULL`]);
			if (query.archived !== undefined) conditions.push(['archived = ?', query.archived ? 1 : 0]);
			const [sql, params] = where(conditions);
			return db.all('workout_templates', `${sql ?? '1'} ORDER BY created_at`, params);
		},
	}),
	route({
		method: 'GET',
		path: '/templates/{id}',
		tag: 'Templates',
		summary: 'Get a workout template',
		response: M.Template,
		run: context => context.db.find('workout_templates', id(context), 'template'),
	}),
	route({
		method: 'POST',
		path: '/templates',
		tag: 'Templates',
		summary: 'Create a workout template in the library',
		description: 'To add a day to a program, PATCH the program with a `template` day instead.',
		body: M.TemplateCreate,
		response: M.Template,
		run({ db, body, now }) {
			assertExercises(db, body.blocks);
			assertNoLogs(body.blocks);
			assertGym(db, body.gymId);
			const row: TemplateRow = {
				id: M.newId(),
				...body,
				gymId: body.gymId?.toLowerCase() ?? null,
				programId: null,
				createdAt: now,
				updatedAt: now,
			};
			db.commit(db.put('workout_templates', row));
			return row;
		},
	}),
	route({
		method: 'PATCH',
		path: '/templates/{id}',
		tag: 'Templates',
		summary: 'Edit a workout template',
		description: '`blocks` replaces the whole tree. Read the template first and send it back changed.',
		body: M.TemplatePatch,
		response: M.Template,
		run({ db, params, body, now }) {
			db.find('workout_templates', params.id!, 'template');
			assertExercises(db, body.blocks);
			assertNoLogs(body.blocks);
			assertGym(db, body.gymId);
			db.commit(
				db.patch('workout_templates', params.id!, {
					...body,
					gymId: body.gymId?.toLowerCase() ?? body.gymId,
					updatedAt: now,
				}),
			);
			return db.find('workout_templates', params.id!, 'template');
		},
	}),
	route({
		method: 'DELETE',
		path: '/templates/{id}',
		tag: 'Templates',
		summary: 'Delete a workout template',
		description: 'Sessions started from it stay in history. A program day that pointed at it shows no workout.',
		response: M.Deleted,
		run({ db, params }) {
			db.find('workout_templates', params.id!, 'template');
			db.commit(db.delete('workout_templates', params.id!));
			return { deleted: params.id! };
		},
	}),

	route({
		method: 'GET',
		path: '/sessions',
		tag: 'Sessions',
		summary: 'List logged workouts, newest first',
		query: z.object({
			from: M.instant.optional().meta({ description: 'Started at or after.' }),
			to: M.instant.optional().meta({ description: 'Started before.' }),
			status: z.enum(['finished', 'inProgress']).optional(),
			exerciseId: z.string().optional().meta({ description: 'Only sessions that include this exercise.' }),
			templateId: z.guid().optional(),
			programId: z.guid().optional(),
			limit: limit(20, 200),
			offset,
		}),
		response: z.array(M.Session),
		run({ db, query }) {
			const conditions: [string, ...(string | number)[]][] = [];
			if (query.from) conditions.push(['started_at >= ?', query.from]);
			if (query.to) conditions.push(['started_at < ?', query.to]);
			if (query.status) conditions.push([`ended_at IS ${query.status === 'finished' ? 'NOT ' : ''}NULL`]);
			if (query.exerciseId)
				conditions.push(['instr(blocks, ?) > 0', `"exerciseID":${JSON.stringify(query.exerciseId)}`]);
			if (query.templateId) conditions.push(['template_id = ?', query.templateId.toLowerCase()]);
			if (query.programId) conditions.push(['program_id = ?', query.programId.toLowerCase()]);
			const [sql, params] = where(conditions);
			return db.all('workout_sessions', `${sql ?? '1'} ORDER BY started_at DESC LIMIT ? OFFSET ?`, [
				...params,
				query.limit,
				query.offset,
			]);
		},
	}),
	route({
		method: 'GET',
		path: '/sessions/{id}',
		tag: 'Sessions',
		summary: 'Get a logged workout',
		response: M.Session,
		run: context => context.db.find('workout_sessions', id(context), 'session'),
	}),
	route({
		method: 'POST',
		path: '/sessions',
		tag: 'Sessions',
		summary: 'Log a finished workout, or start one on the phone',
		description:
			"With `templateId` and no `blocks`, the session copies the template, as starting it in the app does. Logging a program day does not advance the program's cycle; PATCH the program's `currentCycle` for that.",
		body: M.SessionCreate,
		response: M.Session,
		run({ db, body }) {
			const template = body.templateId
				? db.find('workout_templates', body.templateId.toLowerCase(), 'template')
				: undefined;
			const name = body.name ?? template?.name;
			if (!name) throw new ApiError(400, 'name is required without a templateId');
			const owner = body.program && program(db.find('programs', body.program.programId.toLowerCase(), 'program'));
			if (owner && !owner.days.some(day => sameId(day.id, body.program!.dayId))) {
				throw new ApiError(422, `Program ${owner.id} has no day ${body.program!.dayId}`);
			}
			if (body.endedAt && body.endedAt < body.startedAt) throw new ApiError(400, 'endedAt is before startedAt');
			if (!body.endedAt && db.all('workout_sessions', 'ended_at IS NULL').length) {
				throw new ApiError(409, 'A workout is already in progress. Finish it (PATCH endedAt) first.');
			}
			const templateBlocks = (template?.blocks ?? []) as M.Blocks;
			const blocks =
				body.blocks ?? (owner ? blocksForCycle(owner, templateBlocks, body.program!.cycle) : templateBlocks);
			assertExercises(db, blocks);
			const gymId = body.gymId === undefined ? (template?.gymId ?? null) : (body.gymId?.toLowerCase() ?? null);
			assertGym(db, gymId);
			const row: SessionRow = {
				id: M.newId(),
				name,
				templateId: template?.id ?? null,
				startedAt: body.startedAt,
				endedAt: body.endedAt,
				notes: body.notes,
				blocks: stampLogs(blocks, body.endedAt ?? body.startedAt),
				programId: body.program?.programId.toLowerCase() ?? null,
				programDayId: body.program?.dayId.toLowerCase() ?? null,
				cycle: body.program?.cycle ?? null,
				gymId,
				pausedSeconds: body.pausedSeconds,
				health: null,
			};
			db.commit(db.put('workout_sessions', row));
			return row;
		},
	}),
	route({
		method: 'PATCH',
		path: '/sessions/{id}',
		tag: 'Sessions',
		summary: 'Edit a logged workout, or finish one in progress',
		description: '`blocks` replaces the whole tree. `program: null` detaches the session from its program.',
		body: M.SessionPatch,
		response: M.Session,
		run({ db, params, body }) {
			const existing = db.find('workout_sessions', params.id!, 'session');
			const { program: position, ...rest } = body;
			const endedAt = body.endedAt === undefined ? existing.endedAt : body.endedAt;
			const startedAt = body.startedAt ?? existing.startedAt;
			if (endedAt && endedAt < startedAt) throw new ApiError(400, 'endedAt is before startedAt');
			if (!endedAt && db.all('workout_sessions', 'ended_at IS NULL AND id != ?', [existing.id]).length) {
				throw new ApiError(409, 'Another workout is already in progress');
			}
			assertExercises(db, body.blocks);
			assertGym(db, body.gymId);
			const changes: Partial<SessionRow> = { ...rest, gymId: body.gymId?.toLowerCase() ?? body.gymId };
			if (body.blocks) changes.blocks = stampLogs(body.blocks, endedAt ?? startedAt);
			if (position !== undefined) {
				Object.assign(changes, {
					programId: position?.programId.toLowerCase() ?? null,
					programDayId: position?.dayId.toLowerCase() ?? null,
					cycle: position?.cycle ?? null,
				});
			}
			db.commit(db.patch('workout_sessions', existing.id, changes));
			return db.find('workout_sessions', existing.id, 'session');
		},
	}),
	route({
		method: 'DELETE',
		path: '/sessions/{id}',
		tag: 'Sessions',
		summary: 'Delete a logged workout',
		response: M.Deleted,
		run({ db, params }) {
			db.find('workout_sessions', params.id!, 'session');
			db.commit(db.delete('workout_sessions', params.id!));
			return { deleted: params.id! };
		},
	}),

	route({
		method: 'GET',
		path: '/programs',
		tag: 'Programs',
		summary: 'List programs',
		query: z.object({ active: flag.optional(), archived: flag.optional() }),
		response: z.array(M.Program),
		run({ db, query }) {
			const conditions: [string, ...(string | number)[]][] = [];
			if (query.active !== undefined) conditions.push(['active = ?', query.active ? 1 : 0]);
			if (query.archived !== undefined) conditions.push(['archived = ?', query.archived ? 1 : 0]);
			const [sql, params] = where(conditions);
			return db.all('programs', `${sql ?? '1'} ORDER BY created_at`, params).map(program);
		},
	}),
	route({
		method: 'GET',
		path: '/programs/{id}',
		tag: 'Programs',
		summary: 'Get a program with its templates and the next day to train',
		response: M.ProgramDetail,
		run: context => programDetail(context.db, context.db.find('programs', id(context), 'program')),
	}),
	route({
		method: 'POST',
		path: '/programs',
		tag: 'Programs',
		summary: 'Create a program, with new templates inline',
		description:
			'Each day is a rest day, an existing template (`templateId`), or a new one (`template`) created as part of the program. With `config.periodization`, give exercises `cycleTargets`, one entry per cycle.',
		body: M.ProgramCreate,
		response: M.ProgramDetail,
		run({ db, body, now }) {
			const programId = M.newId();
			const { days, changes } = resolveDays(db, body.days, programId, [], now);
			const row: ProgramRow = {
				id: programId,
				name: body.name,
				color: body.color,
				icon: body.icon,
				cycles: body.cycles,
				currentCycle: 1,
				active: false,
				archived: false,
				config: { dayOrder: 'rolling', deload: 'none', periodization: false, ...body.config },
				days,
				createdAt: now,
				updatedAt: now,
			};
			db.commit(...changes, db.put('programs', row), ...(body.activate ? activation(db, row, now) : []));
			return programDetail(db, db.find('programs', programId, 'program'));
		},
	}),
	route({
		method: 'PATCH',
		path: '/programs/{id}',
		tag: 'Programs',
		summary: 'Edit a program: settings, cycle, or days',
		body: M.ProgramPatch,
		response: M.ProgramDetail,
		run({ db, params, body, now }) {
			const existing = db.find('programs', params.id!, 'program');
			const { days: dayInputs, config, ...rest } = body;
			const resolved = dayInputs && resolveDays(db, dayInputs, existing.id, existing.days as ProgramDay[], now);
			db.commit(
				...(resolved?.changes ?? []),
				db.patch('programs', existing.id, {
					...rest,
					...(body.archived && { active: false }),
					...(config && { config: { ...(existing.config as Config), ...config } }),
					...(resolved && { days: resolved.days }),
					updatedAt: now,
				}),
			);
			return programDetail(db, db.find('programs', existing.id, 'program'));
		},
	}),
	route({
		method: 'POST',
		path: '/programs/{id}/activate',
		tag: 'Programs',
		summary: 'Make the program the active one, starting a fresh run at cycle 1',
		response: M.ProgramDetail,
		run({ db, params, now }) {
			const row = db.find('programs', params.id!, 'program');
			db.commit(...activation(db, row, now));
			return programDetail(db, db.find('programs', row.id, 'program'));
		},
	}),
	route({
		method: 'POST',
		path: '/programs/{id}/deactivate',
		tag: 'Programs',
		summary: 'Deactivate the program and reset its progress',
		response: M.ProgramDetail,
		run({ db, params, now }) {
			const row = db.find('programs', params.id!, 'program');
			db.commit(
				db.patch('programs', row.id, {
					active: false,
					currentCycle: 1,
					days: (row.days as ProgramDay[]).map(({ restDoneInCycle: _, ...day }) => day),
					updatedAt: now,
				}),
			);
			return programDetail(db, db.find('programs', row.id, 'program'));
		},
	}),
	route({
		method: 'DELETE',
		path: '/programs/{id}',
		tag: 'Programs',
		summary: 'Delete a program and its templates',
		description: 'Its sessions stay in history. Archive it with PATCH instead to keep it.',
		response: M.Deleted,
		run({ db, params }) {
			const row = db.find('programs', params.id!, 'program');
			const templates = db.all('workout_templates', 'program_id = ?', [row.id]);
			db.commit(...templates.map(t => db.delete('workout_templates', t.id)), db.delete('programs', row.id));
			return { deleted: row.id };
		},
	}),

	route({
		method: 'GET',
		path: '/gyms',
		tag: 'Gyms',
		summary: 'List gym profiles',
		response: z.array(M.Gym),
		run: ({ db }) => db.all('gym_profiles', '1 ORDER BY created_at'),
	}),
	route({
		method: 'GET',
		path: '/gyms/{id}',
		tag: 'Gyms',
		summary: 'Get a gym profile',
		response: M.Gym,
		run: context => context.db.find('gym_profiles', id(context), 'gym'),
	}),
	route({
		method: 'POST',
		path: '/gyms',
		tag: 'Gyms',
		summary: 'Create a gym profile',
		description: 'The first gym becomes the default.',
		body: M.GymCreate,
		response: M.Gym,
		run({ db, body, now }) {
			assertEquipment(Object.keys(body.equipment));
			const others = db.all('gym_profiles');
			const row: RowOf<'gym_profiles'> = {
				id: M.newId(),
				...body,
				isDefault: body.isDefault || !others.length,
				createdAt: now,
				updatedAt: now,
			};
			const demoted = row.isDefault ? others.filter(gym => gym.isDefault) : [];
			db.commit(
				db.put('gym_profiles', row),
				...demoted.map(gym => db.patch('gym_profiles', gym.id, { isDefault: false, updatedAt: now })),
			);
			return row;
		},
	}),
	route({
		method: 'PATCH',
		path: '/gyms/{id}',
		tag: 'Gyms',
		summary: 'Edit a gym profile',
		description: '`equipment` replaces the whole map.',
		body: M.GymPatch,
		response: M.Gym,
		run({ db, params, body, now }) {
			db.find('gym_profiles', params.id!, 'gym');
			if (body.equipment) assertEquipment(Object.keys(body.equipment));
			db.commit(db.patch('gym_profiles', params.id!, { ...body, updatedAt: now }));
			return db.find('gym_profiles', params.id!, 'gym');
		},
	}),
	route({
		method: 'POST',
		path: '/gyms/{id}/default',
		tag: 'Gyms',
		summary: 'Make the gym the default',
		response: M.Gym,
		run({ db, params, now }) {
			const row = db.find('gym_profiles', params.id!, 'gym');
			const changes = db
				.all('gym_profiles')
				.filter(gym => gym.isDefault !== (gym.id === row.id))
				.map(gym => db.patch('gym_profiles', gym.id, { isDefault: gym.id === row.id, updatedAt: now }));
			db.commit(...changes);
			return db.find('gym_profiles', row.id, 'gym');
		},
	}),
	route({
		method: 'DELETE',
		path: '/gyms/{id}',
		tag: 'Gyms',
		summary: 'Delete a gym profile',
		response: M.Deleted,
		run({ db, params }) {
			db.find('gym_profiles', params.id!, 'gym');
			db.commit(db.delete('gym_profiles', params.id!));
			return { deleted: params.id! };
		},
	}),

	route({
		method: 'GET',
		path: '/settings',
		tag: 'Settings',
		summary: 'Get the weight unit, rest defaults, and profile',
		response: M.Settings,
		run: ({ db }) => settings(db),
	}),
	route({
		method: 'PATCH',
		path: '/settings',
		tag: 'Settings',
		summary: 'Change the weight unit, rest defaults, or profile',
		description: '`profile` merges into the stored profile.',
		body: M.SettingsPatch,
		response: M.Settings,
		run({ db, body }) {
			const current = settings(db);
			const rest = { ...current.rest, ...body.rest };
			const values = {
				weightUnit: body.weightUnit ?? current.weightUnit,
				restCompoundUpper: rest.compoundUpper,
				restCompoundLower: rest.compoundLower,
				restUpperIsolation: rest.upperIsolation,
				restLowerIsolation: rest.lowerIsolation,
				restCore: rest.core,
				profile: { ...current.profile, ...body.profile },
			};
			const exists = db.get('settings', SETTINGS_ID);
			db.commit(
				exists
					? db.patch('settings', SETTINGS_ID, values)
					: db.put('settings', { ...current, ...values, nutrition: {}, id: SETTINGS_ID }),
			);
			return settings(db);
		},
	}),

	route({
		method: 'GET',
		path: '/body-weights',
		tag: 'Body weight',
		summary: 'List logged body weights, newest first',
		description: 'Only weigh-ins logged in the app or here. HealthKit samples never leave the phone.',
		query: z.object({ from: M.instant.optional(), to: M.instant.optional(), limit: limit(100, 1000) }),
		response: z.array(M.BodyWeight),
		run({ db, query }) {
			const conditions: [string, ...(string | number)[]][] = [];
			if (query.from) conditions.push(['measured_at >= ?', query.from]);
			if (query.to) conditions.push(['measured_at < ?', query.to]);
			const [sql, params] = where(conditions);
			return db.all('body_weights', `${sql ?? '1'} ORDER BY measured_at DESC LIMIT ?`, [...params, query.limit]);
		},
	}),
	route({
		method: 'POST',
		path: '/body-weights',
		tag: 'Body weight',
		summary: 'Log a body weight',
		body: M.BodyWeightCreate,
		response: M.BodyWeight,
		run({ db, body }) {
			const row: RowOf<'body_weights'> = { id: M.newId(), ...body, source: 'manual', bodyFatPercent: null };
			db.commit(db.put('body_weights', row));
			return row;
		},
	}),
	route({
		method: 'DELETE',
		path: '/body-weights/{id}',
		tag: 'Body weight',
		summary: 'Delete a logged body weight',
		response: M.Deleted,
		run({ db, params }) {
			db.find('body_weights', params.id!, 'body weight');
			db.commit(db.delete('body_weights', params.id!));
			return { deleted: params.id! };
		},
	}),
];

/** What the authenticated root returns besides the docs: enough state that an agent knows where things stand. */
export function snapshot(db: Db) {
	const active = db.all('programs', 'active = 1 ORDER BY updated_at DESC')[0];
	const defaultGym = db.all('gym_profiles', 'is_default = 1 ORDER BY updated_at DESC')[0];
	const inProgress = db.all('workout_sessions', 'ended_at IS NULL')[0];
	const last = db.all('workout_sessions', 'ended_at IS NOT NULL ORDER BY started_at DESC LIMIT 1')[0];
	const count = (table: Parameters<Db['all']>[0]) => db.all(table).length;
	return {
		weightUnit: settings(db).weightUnit,
		activeProgram: active ? (({ templates: _, ...detail }) => detail)(programDetail(db, active)) : null,
		defaultGym: defaultGym ? { id: defaultGym.id, name: defaultGym.name } : null,
		inProgressSession: inProgress
			? { id: inProgress.id, name: inProgress.name, startedAt: inProgress.startedAt }
			: null,
		lastSession: last ? { id: last.id, name: last.name, startedAt: last.startedAt, endedAt: last.endedAt } : null,
		counts: {
			templates: count('workout_templates'),
			sessions: count('workout_sessions'),
			programs: count('programs'),
			gyms: count('gym_profiles'),
			customExercises: count('custom_exercises'),
			bodyWeights: count('body_weights'),
		},
	};
}
