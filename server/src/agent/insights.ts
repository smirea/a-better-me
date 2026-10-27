import { z } from 'zod';
import { SETTINGS_ID, SYNCED_TABLES, type SyncedTable } from '../../../shared/db/schema';
import { exerciseLookup } from './catalog';
import type { Db } from './db';
import {
	dayIn,
	expenditure,
	weightInsights,
	weightTrend,
	type Day,
	type ExpenditureSettings,
	type Profile,
} from './engine';
import { sessionStats } from './metrics';
import * as M from './models';
import { logDays } from './nutrition';
import { route, type Route } from './route';

const range = z.object({
	from: M.day.optional().meta({ description: 'The first day, inclusive.' }),
	to: M.day.optional().meta({ description: 'The last day, inclusive.' }),
	tz: M.timeZone,
});
const within = (day: Day, query: { from?: Day; to?: Day }) =>
	(!query.from || day >= query.from) && (!query.to || day <= query.to);

function nutritionInputs(db: Db) {
	const row = db.get('settings', SETTINGS_ID);
	const nutrition = (row?.nutrition ?? {}) as { expenditure?: ExpenditureSettings };
	return { settings: nutrition.expenditure ?? {}, profile: (row?.profile ?? {}) as Profile };
}

/** The app's weigh-ins on the owner's calendar. HealthKit samples never reach the server, so they are not in here. */
function weighIns(db: Db, timeZone: string) {
	return db.all('body_weights').map(row => ({ day: dayIn(row.measuredAt, timeZone), value: row.weightKg }));
}

export function trendFor(db: Db, timeZone: string, now: string) {
	const today = dayIn(now, timeZone);
	const points = weighIns(db, timeZone);
	return { today, points, trend: weightTrend(points, today) };
}

export function expenditureFor(db: Db, timeZone: string, now: string) {
	const { today, points, trend } = trendFor(db, timeZone, now);
	const intake = new Map(
		logDays(db, {}).flatMap(day => (day.countedKcal === null ? [] : [[day.day, day.countedKcal] as const])),
	);
	return { today, trend, result: expenditure({ intake, weighIns: points, trend, today, ...nutritionInputs(db) }) };
}

const best = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));

/** Every synced table but the token hashes, decoded as the API returns rows. */
const EXPORTED = (Object.keys(SYNCED_TABLES) as SyncedTable[]).filter(table => table !== 'api_tokens');

export const insightRoutes: Route[] = [
	route({
		method: 'GET',
		path: '/weight-trend',
		tag: 'Insights',
		summary: 'The daily trend weight, as the Dashboard draws it, with its weekly rate and projection',
		description:
			"MacroFactor's Weight Trend V1 over the weigh-ins logged in the app or here: an exponential moving average with gaps interpolated. Pass `tz` so a weigh-in lands on the day the phone puts it on.",
		query: range,
		response: M.WeightTrend,
		run({ db, query, now }) {
			const { today, trend } = trendFor(db, query.tz, now);
			const current = weightInsights(trend, today);
			return { today, current, days: trend.filter(day => within(day.day, query)) };
		},
	}),
	route({
		method: 'GET',
		path: '/expenditure',
		tag: 'Insights',
		summary: 'The daily energy expenditure (TDEE) estimate, as the Dashboard and the check-in compute it',
		description:
			'Recomputed from the weigh-ins, the food log, and `settings.nutrition.expenditure` on every call, so an edit to a past day is reflected at once.',
		query: range,
		response: M.ExpenditureSeries,
		run({ db, query, now }) {
			const { today, result } = expenditureFor(db, query.tz, now);
			if (!result.strategy) {
				return {
					today,
					strategy: null,
					missing: result.missing,
					start: null,
					initialKcal: null,
					currentKcal: null,
					days: [],
				};
			}
			return {
				today,
				strategy: result.strategy,
				missing: null,
				start: result.start,
				initialKcal: result.initialKcal,
				currentKcal: result.days.at(-1)?.kcal ?? null,
				days: result.days.filter(day => within(day.day, query)),
			};
		},
	}),
	route({
		method: 'GET',
		path: '/training-summary',
		tag: 'Insights',
		summary: "Finished workouts in a range, added up: sets per muscle, volume, and each exercise's bests",
		description: 'Call it once per week or month for a series. `GET /sessions` has the same stats per workout.',
		query: z.object({
			from: M.instant.optional().meta({ description: 'Started at or after.' }),
			to: M.instant.optional().meta({ description: 'Started before.' }),
		}),
		response: M.TrainingSummary,
		run({ db, query }) {
			const lookup = exerciseLookup(db);
			const sessions = db
				.all('workout_sessions', 'ended_at IS NOT NULL')
				.filter(s => (!query.from || s.startedAt >= query.from) && (!query.to || s.startedAt < query.to))
				.map(s => sessionStats(s, lookup));
			const muscleSets: Record<string, number> = {};
			const exercises = new Map<string, z.output<typeof M.TrainingSummary>['exercises'][number]>();
			for (const stats of sessions) {
				for (const [muscle, sets] of Object.entries(stats.muscleSets))
					muscleSets[muscle] = (muscleSets[muscle] ?? 0) + sets;
				for (const e of stats.exercises) {
					const sum = exercises.get(e.exerciseID);
					exercises.set(
						e.exerciseID,
						sum
							? {
									...sum,
									sessions: sum.sessions + 1,
									loggedSets: sum.loggedSets + e.loggedSets,
									workingSets: sum.workingSets + e.workingSets,
									volumeKg: sum.volumeKg + e.volumeKg,
									bestReps: best(sum.bestReps, e.bestReps),
									bestEstimatedOneRepMaxKg: best(sum.bestEstimatedOneRepMaxKg, e.bestEstimatedOneRepMaxKg),
								}
							: { ...e, sessions: 1 },
					);
				}
			}
			return {
				sessions: sessions.length,
				durationSeconds: sessions.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0),
				workingSets: sessions.reduce((sum, s) => sum + s.workingSets, 0),
				volumeKg: sessions.reduce((sum, s) => sum + s.volumeKg, 0),
				muscleSets,
				exercises: [...exercises.values()].toSorted((a, b) => b.workingSets - a.workingSets),
			};
		},
	}),
	route({
		method: 'GET',
		path: '/export',
		tag: 'Insights',
		summary: 'Every stored row of every table, in one response',
		description:
			'A backup or a full analysis in one call. Rows are as stored: JSON trees whole, weights in kg, no derived fields. The token table is left out.',
		response: z.object({
			exportedAt: z.string(),
			tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
		}),
		run: ({ db, now }) => ({
			exportedAt: now,
			tables: Object.fromEntries(EXPORTED.map(table => [table, db.all(table)])),
		}),
	}),
];
