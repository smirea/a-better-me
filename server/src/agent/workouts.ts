import { z } from 'zod';
import { ApiError } from '../http';
import { exerciseLookup } from './catalog';
import type { Db, RowOf } from './db';
import { assertExercises } from './exercises';
import { assertGym } from './gyms';
import { sessionStats } from './metrics';
import * as M from './models';
import { assertNoLogs, stampLogs } from './blocks';
import { blocksForCycle, program } from './programs';
import { flag, fresh, limit, offset, paged, pagedList, route, where, type Condition, type Route } from './route';

type TemplateRow = RowOf<'workout_templates'>;
type SessionRow = RowOf<'workout_sessions'>;

const withStats = (db: Db) => {
	const lookup = exerciseLookup(db);
	return (row: SessionRow) => ({ ...row, stats: sessionStats(row, lookup) });
};
const session = (db: Db, id: string) => withStats(db)(db.find('workout_sessions', id, 'session'));

export const workoutRoutes: Route[] = [
	route({
		method: 'GET',
		path: '/templates',
		tag: 'Templates',
		summary: 'List workout templates',
		query: z.object({
			programId: M.ref.optional().meta({ description: "Only this program's days." }),
			library: flag
				.optional()
				.meta({ description: 'true: only templates outside programs. false: only program days.' }),
			archived: flag.optional(),
		}),
		response: z.array(M.Template),
		run({ db, query }) {
			const conditions: Condition[] = [];
			if (query.programId) conditions.push(['program_id = ?', query.programId]);
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
		run: context => context.db.find('workout_templates', context.params.id!, 'template'),
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
				gymId: body.gymId ?? null,
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
					gymId: body.gymId,
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
			templateId: M.ref.optional(),
			programId: M.ref.optional(),
			limit: limit(20, 200),
			offset,
		}),
		response: paged(M.Session),
		run({ db, query }) {
			const conditions: Condition[] = [];
			if (query.from) conditions.push(['started_at >= ?', query.from]);
			if (query.to) conditions.push(['started_at < ?', query.to]);
			if (query.status) conditions.push([`ended_at IS ${query.status === 'finished' ? 'NOT ' : ''}NULL`]);
			if (query.exerciseId)
				conditions.push(['instr(blocks, ?) > 0', `"exerciseID":${JSON.stringify(query.exerciseId)}`]);
			if (query.templateId) conditions.push(['template_id = ?', query.templateId]);
			if (query.programId) conditions.push(['program_id = ?', query.programId]);
			return pagedList(db, 'workout_sessions', conditions, 'started_at DESC', query, withStats(db));
		},
	}),
	route({
		method: 'GET',
		path: '/sessions/{id}',
		tag: 'Sessions',
		summary: 'Get a logged workout',
		response: M.Session,
		run: context => session(context.db, context.params.id!),
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
			const template = body.templateId ? db.find('workout_templates', body.templateId, 'template') : undefined;
			const name = body.name ?? template?.name;
			if (!name) throw new ApiError(400, 'name is required without a templateId');
			const owner = body.program && program(db.find('programs', body.program.programId, 'program'));
			if (owner && !owner.days.some(day => day.id === body.program!.dayId)) {
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
			const gymId = body.gymId === undefined ? (template?.gymId ?? null) : (body.gymId ?? null);
			assertGym(db, gymId);
			const row: SessionRow = {
				id: fresh(db, 'workout_sessions', body.id),
				name,
				templateId: template?.id ?? null,
				startedAt: body.startedAt,
				endedAt: body.endedAt,
				notes: body.notes,
				blocks: stampLogs(blocks, body.endedAt ?? body.startedAt),
				programId: body.program?.programId ?? null,
				programDayId: body.program?.dayId ?? null,
				cycle: body.program?.cycle ?? null,
				gymId,
				pausedSeconds: body.pausedSeconds,
				health: null,
			};
			db.commit(db.put('workout_sessions', row));
			return withStats(db)(row);
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
			const changes: Partial<SessionRow> = { ...rest, gymId: body.gymId };
			if (body.blocks) changes.blocks = stampLogs(body.blocks, endedAt ?? startedAt);
			if (position !== undefined) {
				Object.assign(changes, {
					programId: position?.programId ?? null,
					programDayId: position?.dayId ?? null,
					cycle: position?.cycle ?? null,
				});
			}
			db.commit(db.patch('workout_sessions', existing.id, changes));
			return session(db, existing.id);
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
];
