import { z } from 'zod';
import { BODY_METRIC_KINDS } from '../../../shared/db/schema';
import { ApiError } from '../http';
import type { RowOf } from './db';
import * as M from './models';
import {
	dayParam,
	dayRange,
	days,
	fresh,
	limit,
	offset,
	page,
	paged,
	pagedList,
	route,
	type Condition,
	type Route,
} from './route';

const READ_ONLY =
	'Rows with `source: "healthkit"` are read-only: a PATCH, PUT, or DELETE of one answers 409. Change the reading in the Health app and the phone copies the change on its next open.';

/** Only Apple Health can change a reading it holds, and the phone would write Health's value back over an edit made here. */
function refuseHealthCopy(row: { id: string; source: string }) {
	if (row.source !== 'healthkit') return;
	throw new ApiError(
		409,
		`${row.id} is copied from Apple Health, so it is read-only here. Change it in the Health app; the phone copies the change on its next open.`,
	);
}

export const bodyRoutes: Route[] = [
	route({
		method: 'GET',
		path: '/body-weights',
		tag: 'Body weight',
		summary: 'List body weights, newest first',
		description:
			"Every weigh-in: the ones logged in the app or here (`manual`) and the phone's copies of Apple Health's (`healthkit`). A Health sample that is the same reading as a manual weigh-in is not copied. " +
			READ_ONLY,
		query: z.object({ from: M.instant.optional(), to: M.instant.optional(), limit: limit(100, 1000), offset }),
		response: paged(M.BodyWeight),
		run({ db, query }) {
			const conditions: Condition[] = [];
			if (query.from) conditions.push(['measured_at >= ?', query.from]);
			if (query.to) conditions.push(['measured_at < ?', query.to]);
			return pagedList(db, 'body_weights', conditions, 'measured_at DESC, id', query);
		},
	}),
	route({
		method: 'GET',
		path: '/body-weights/{id}',
		tag: 'Body weight',
		summary: 'Get a logged body weight',
		response: M.BodyWeight,
		run: ({ db, params }) => db.find('body_weights', params.id!, 'body weight'),
	}),
	route({
		method: 'POST',
		path: '/body-weights',
		tag: 'Body weight',
		summary: 'Log a body weight',
		body: M.BodyWeightCreate,
		response: M.BodyWeight,
		run({ db, body }) {
			const row: RowOf<'body_weights'> = { ...body, id: fresh(db, 'body_weights', body.id), source: 'manual' };
			db.commit(db.put('body_weights', row));
			return row;
		},
	}),
	route({
		method: 'PATCH',
		path: '/body-weights/{id}',
		tag: 'Body weight',
		summary: 'Edit a logged body weight',
		description: READ_ONLY,
		body: M.BodyWeightPatch,
		response: M.BodyWeight,
		run({ db, params, body }) {
			refuseHealthCopy(db.find('body_weights', params.id!, 'body weight'));
			db.commit(db.patch('body_weights', params.id!, body));
			return db.find('body_weights', params.id!, 'body weight');
		},
	}),
	route({
		method: 'DELETE',
		path: '/body-weights/{id}',
		tag: 'Body weight',
		summary: 'Delete a logged body weight',
		description: READ_ONLY,
		response: M.Deleted,
		run({ db, params }) {
			refuseHealthCopy(db.find('body_weights', params.id!, 'body weight'));
			db.commit(db.delete('body_weights', params.id!));
			return { deleted: params.id! };
		},
	}),
	route({
		method: 'GET',
		path: '/body-metrics',
		tag: 'Body weight',
		summary:
			'List visual body fat, tape measurements, and daily steps, flights climbed, and walking distance, oldest first',
		description:
			"Steps, flights climbed, and walking distance are Apple Health's daily totals, copied by the phone (`healthkit`); a `manual` step count stays on a day Health has none. " +
			READ_ONLY,
		query: days.extend({ kind: z.enum(BODY_METRIC_KINDS).optional(), ...page }),
		response: paged(M.BodyMetric),
		run({ db, query }) {
			const conditions = dayRange('day', query);
			if (query.kind) conditions.push(['kind = ?', query.kind]);
			return pagedList(db, 'body_metrics', conditions, 'day, kind', query);
		},
	}),
	route({
		method: 'PUT',
		path: '/body-metrics/{day}/{kind}',
		tag: 'Body weight',
		summary: "Set a day's value of a body metric",
		description:
			"Centimeters for tape measurements, a percent for `visual_body_fat`, a count for `steps` and `flights_climbed`, meters for `walking_distance`. The row is `manual`; the phone replaces it with Apple Health's total once Health has one for the day. " +
			READ_ONLY,
		body: M.BodyMetricPut,
		response: M.BodyMetric,
		run({ db, params, body, now }) {
			const day = dayParam(params);
			const kind = z.enum(BODY_METRIC_KINDS).parse(params.kind);
			const stored = db.get('body_metrics', `${day}/${kind}`);
			if (stored) refuseHealthCopy(stored);
			const row: RowOf<'body_metrics'> = {
				id: `${day}/${kind}`,
				day,
				kind,
				value: body.value,
				source: 'manual',
				updatedAt: now,
			};
			db.commit(db.put('body_metrics', row));
			return row;
		},
	}),
	route({
		method: 'DELETE',
		path: '/body-metrics/{day}/{kind}',
		tag: 'Body weight',
		summary: "Clear a day's value of a body metric",
		description: READ_ONLY,
		response: M.Deleted,
		run({ db, params }) {
			const stored = db.find('body_metrics', `${dayParam(params)}/${params.kind}`, 'body metric');
			refuseHealthCopy(stored);
			const id = stored.id;
			db.commit(db.delete('body_metrics', id));
			return { deleted: id };
		},
	}),
];
