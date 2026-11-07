import { z } from 'zod';
import { ApiError } from '../http';
import {
	CATALOG_EXERCISES,
	catalogExercise,
	EQUIPMENT,
	EQUIPMENT_BY_ID,
	exerciseLookup,
	gymProvides,
	type Exercise,
} from './catalog';
import type { Db } from './db';
import { statsByExercise } from './metrics';
import * as M from './models';
import { flag, limit, offset, paged, pagedList, route, type Condition, type Route } from './route';

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

export function assertExercises(db: Db, blocks: M.Blocks | undefined) {
	const ids = new Set(blocks?.flatMap(block => block.exercises.map(exercise => exercise.exerciseID)));
	const unknown = [...ids].filter(id => !catalogExercise(id) && !db.get('custom_exercises', id));
	if (unknown.length)
		throw new ApiError(422, `Unknown exercise ids: ${unknown.join(', ')}. Look them up in GET /exercises.`);
}

export function assertEquipment(ids: Iterable<string>) {
	const unknown = [...ids].filter(id => !EQUIPMENT_BY_ID.has(id));
	if (unknown.length) throw new ApiError(422, `Unknown equipment ids: ${unknown.join(', ')}. See GET /equipment.`);
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
		overrides: (row?.overrides as Record<string, unknown> | undefined) ?? {},
	};
}

function hasEquipment(provided: Set<string>, exercise: Exercise) {
	const has = (options: string[][]) => !options.length || options.some(ids => ids.every(id => provided.has(id)));
	return has(exercise.resistanceEquipmentIDs) && has(exercise.supportEquipmentIDs);
}

export const exerciseRoutes: Route[] = [
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
			gymId: M.ref.optional().meta({ description: "Only exercises this gym's equipment allows." }),
			custom: flag.optional(),
			includeArchived: flag.default(false),
			limit: limit(50, 500),
			offset,
		}),
		response: z.object({ total: z.int(), items: z.array(M.Exercise) }),
		run({ db, query }) {
			const gym =
				query.gymId && gymProvides(Object.keys(db.find('gym_profiles', query.gymId, 'gym').equipment as object));
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
		run: context => ({
			...findExercise(context.db, context.params.id!),
			settings: exerciseSettings(context.db, context.params.id!),
		}),
	}),
	route({
		method: 'GET',
		path: '/exercises/{id}/history',
		tag: 'Exercises',
		summary: 'Every finished session that trained the exercise, with its sets',
		description:
			'The input for progression: weights, reps, and RIR per set, newest session first, with the stats the app derives from them.',
		query: z.object({
			from: M.instant.optional().meta({ description: 'Started at or after.' }),
			to: M.instant.optional().meta({ description: 'Started before.' }),
			limit: limit(10, 1000),
			offset,
		}),
		response: paged(M.ExerciseHistoryEntry),
		run({ db, params, query }) {
			findExercise(db, params.id!);
			const lookup = exerciseLookup(db);
			const conditions: Condition[] = [
				['ended_at IS NOT NULL'],
				['instr(blocks, ?) > 0', `"exerciseID":${JSON.stringify(params.id)}`],
			];
			if (query.from) conditions.push(['started_at >= ?', query.from]);
			if (query.to) conditions.push(['started_at < ?', query.to]);
			return pagedList(db, 'workout_sessions', conditions, 'started_at DESC', query, row => {
				const exercises = (row.blocks as M.Blocks).flatMap(b => b.exercises).filter(e => e.exerciseID === params.id);
				return {
					sessionId: row.id,
					sessionName: row.name,
					startedAt: row.startedAt,
					note: exercises.find(e => e.note)?.note ?? null,
					sets: exercises.flatMap(e => e.sets),
					stats: statsByExercise([{ exercises }] as M.Blocks, lookup)[0] ?? null,
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
			const { overrides: changed, ...rest } = body;
			const current = exerciseSettings(db, params.id!);
			const overrides = changed && {
				overrides: Object.fromEntries(
					Object.entries({ ...current.overrides, ...changed }).filter(([, value]) => value !== null),
				),
			};
			db.commit(
				db.get('exercise_settings', params.id!)
					? db.patch('exercise_settings', params.id!, { ...rest, ...overrides })
					: db.put('exercise_settings', { id: params.id!, ...current, ...rest, ...overrides }),
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
];
