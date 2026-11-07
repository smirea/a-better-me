import { z } from 'zod';
import { ApiError } from '../http';
import type { Db, RowOf } from './db';
import { assertExercises } from './exercises';
import { assertGym } from './gyms';
import * as M from './models';
import { flag, route, where, type Condition, type Route } from './route';
import { assertNoLogs } from './blocks';

type TemplateRow = RowOf<'workout_templates'>;
type SessionRow = RowOf<'workout_sessions'>;
type ProgramRow = RowOf<'programs'>;
type ProgramDay = z.output<typeof M.ProgramDay>;
type Config = z.output<typeof M.ProgramConfig>;

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
export function blocksForCycle(row: ReturnType<typeof program>, blocks: M.Blocks, cycle: number): M.Blocks {
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
/** `copyingCycleTargets`: a copy gets its own block, exercise, and set ids, and plans carry no logs. */
function freshBlocks(blocks: M.Blocks): M.Blocks {
	const fresh = <T extends { id: string; log?: unknown }>({ log: _, ...item }: T) => ({ ...item, id: M.newId() });
	const sets = (list: z.output<typeof M.WorkoutSet>[]) =>
		list.map(set => ({ ...fresh(set), subSets: set.subSets.map(fresh) }));
	return blocks.map(block => ({
		...block,
		id: M.newId(),
		exercises: block.exercises.map(exercise => ({
			...exercise,
			id: M.newId(),
			sets: sets(exercise.sets),
			...(exercise.cycleTargets && {
				cycleTargets: exercise.cycleTargets.map(cycle => ({ ...cycle, sets: sets(cycle.sets) })),
			}),
		})),
	})) as M.Blocks;
}
/** Day ids and template ids lowercase, so they compare equal to row ids and a session's `programDayId`. */
export function program(row: ProgramRow) {
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
			.filter(s => s.endedAt && s.programId === row.id && s.cycle === row.currentCycle && s.startedAt >= since)
			.map(s => s.programDayId),
	);
	const next = row.days.find(day => (day.templateID ? !done.has(day.id) : day.restDoneInCycle !== row.currentCycle));
	return next ? { dayId: next.id, templateId: next.templateID ?? null, cycle: row.currentCycle } : null;
}

export function programDetail(db: Db, row: ProgramRow) {
	const shaped = program(row);
	const ids = new Set(shaped.days.flatMap(day => (day.templateID ? [day.templateID] : [])));
	const templates = db.all('workout_templates').filter(t => ids.has(t.id) || t.programId === row.id);
	return { ...shaped, templates, upNext: upNext(shaped, db.all('workout_sessions', 'program_id = ?', [row.id])) };
}

type DayInput = z.output<typeof M.ProgramCreate>['days'][number];

/** Turns day inputs into stored days, creating inline templates. An existing day keeps its rest-day tick. */
function resolveDays(db: Db, inputs: DayInput[], programId: string, previous: ProgramDay[], now: string) {
	const changes: ReturnType<Db['put']>[] = [];
	const days = inputs.map((input): ProgramDay => {
		const kept = input.id ? previous.find(day => day.id === input.id) : undefined;
		const id = input.id ?? M.newId();
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
			db.find('workout_templates', input.templateId, 'template');
			return { id, templateID: input.templateId, ...restDone };
		}
		return { id, ...restDone };
	});
	return { days, changes };
}

/** `LocalStore.activate`: a fresh run from cycle 1, out of the archive, and every other program inactive. */
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

export const programRoutes: Route[] = [
	route({
		method: 'GET',
		path: '/programs',
		tag: 'Programs',
		summary: 'List programs',
		query: z.object({ active: flag.optional(), archived: flag.optional() }),
		response: z.array(M.Program),
		run({ db, query }) {
			const conditions: Condition[] = [];
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
		run: context => programDetail(context.db, context.db.find('programs', context.params.id!, 'program')),
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
			const resolved = dayInputs && resolveDays(db, dayInputs, existing.id, program(existing).days, now);
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
		method: 'POST',
		path: '/programs/{id}/days/{dayId}/rest-done',
		tag: 'Programs',
		summary: 'Tick a rest day done in the current cycle, or untick it',
		description: "The Active Program's rest-day checkbox. A workout day is done by a finished session of it instead.",
		body: z.object({ done: z.boolean().default(true) }),
		response: M.ProgramDetail,
		run({ db, params, body, now }) {
			const row = program(db.find('programs', params.id!, 'program'));
			const target = row.days.find(day => day.id === params.dayId);
			if (!target) throw new ApiError(404, `Program ${row.id} has no day ${params.dayId}`);
			if (target.templateID) throw new ApiError(422, `Day ${target.id} is a workout day, not a rest day`);
			const days = row.days.map(({ restDoneInCycle, ...day }) => {
				const tick = day.id === target.id ? (body.done ? row.currentCycle : undefined) : restDoneInCycle;
				return tick === undefined ? day : { ...day, restDoneInCycle: tick };
			});
			db.commit(db.patch('programs', row.id, { days, updatedAt: now }));
			return programDetail(db, db.find('programs', row.id, 'program'));
		},
	}),
	route({
		method: 'POST',
		path: '/programs/{id}/duplicate',
		tag: 'Programs',
		summary: 'Copy a program and its templates, inactive, named "<name> Copy"',
		response: M.ProgramDetail,
		run({ db, params, now }) {
			const source = program(db.find('programs', params.id!, 'program'));
			const programId = M.newId();
			const changes: ReturnType<Db['put']>[] = [];
			const days = source.days.map((day): ProgramDay => {
				const template = day.templateID && db.get('workout_templates', day.templateID);
				if (!template) return { id: M.newId() };
				const copy: TemplateRow = {
					...template,
					id: M.newId(),
					blocks: freshBlocks(template.blocks as M.Blocks),
					programId,
					createdAt: now,
					updatedAt: now,
				};
				changes.push(db.put('workout_templates', copy));
				return { id: M.newId(), templateID: copy.id };
			});
			const { runStartedAt: _, ...config } = source.config;
			const row: ProgramRow = {
				...source,
				id: programId,
				name: `${source.name} Copy`,
				currentCycle: 1,
				active: false,
				archived: false,
				config,
				days,
				createdAt: now,
				updatedAt: now,
			};
			db.commit(...changes, db.put('programs', row));
			return programDetail(db, db.find('programs', programId, 'program'));
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
];
