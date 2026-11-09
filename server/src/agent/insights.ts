import { z } from 'zod';
import { SETTINGS_ID, SYNCED_TABLES, type SyncedTable } from '../../../shared/db/schema';
import { exerciseLookup } from './catalog';
import type { Db } from './db';
import {
	dayIn,
	expenditure,
	initialEstimate,
	weightInsights,
	weightTrend,
	type Day,
	type ExpenditureSettings,
	type Profile,
} from './engine';
import { maintenance, screenIntake, type CountedDay } from './maintenance';
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

function trendFor(db: Db, timeZone: string, now: string) {
	const today = dayIn(now, timeZone);
	const points = weighIns(db, timeZone);
	return { today, points, trend: weightTrend(points, today) };
}

/** `NutritionExpenditure.countedDays`: the days `DayIntake` counts, with what the incomplete-day screen compares. */
function countedDays(db: Db): CountedDay[] {
	return logDays(db, {}).flatMap(day =>
		day.countedKcal === null
			? []
			: [
					{
						day: day.day,
						kcal: day.countedKcal,
						proteinG: day.consumed.p ?? 0,
						entries: day.entryCount,
						marked: day.override !== null || day.status === 'fasted' || day.status === 'complete',
					},
				],
	);
}

function stepsOf(db: Db) {
	return db
		.all('body_metrics')
		.filter(row => row.kind === 'steps')
		.map(row => ({ day: row.day, value: row.value }));
}

export function expenditureFor(db: Db, timeZone: string, now: string) {
	const { today, points, trend } = trendFor(db, timeZone, now);
	const { counted: intake } = screenIntake(countedDays(db).filter(day => day.day <= today));
	const plans = db.all('nutrition_plans');
	return {
		today,
		trend,
		result: expenditure({ intake, weighIns: points, trend, today, plans, steps: stepsOf(db), ...nutritionInputs(db) }),
	};
}

/** `NutritionExpenditure.maintenance`: the estimate Strategy plans from, with the owner's initial estimate or the BMR one as its prior. */
export function maintenanceFor(db: Db, timeZone: string, now: string) {
	const { today, points, trend } = trendFor(db, timeZone, now);
	const weightKg = trend.at(-1)?.trendKg;
	if (weightKg === undefined) return { today, result: null };
	const { settings, profile } = nutritionInputs(db);
	const bmr = initialEstimate(profile, settings, weightKg, today);
	const prior = settings.initialKcal
		? { kcal: settings.initialKcal, source: 'initial' as const }
		: bmr === null
			? null
			: { kcal: bmr, source: 'bmr' as const };
	const workouts = db.all('workout_sessions', 'ended_at IS NOT NULL').map(session => ({
		day: dayIn(session.startedAt, timeZone),
		minutes:
			Math.max(0, Date.parse(session.endedAt!) - Date.parse(session.startedAt) - session.pausedSeconds * 1000) / 60_000,
	}));
	const result = maintenance({
		days: countedDays(db),
		weighIns: points,
		weightKg,
		steps: stepsOf(db),
		workouts,
		prior,
		from: settings.calculationStart,
		today,
	});
	return { today, result };
}

const best = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));

/** Every synced table but the token hashes, decoded as the API returns rows. */
const EXPORTED = (Object.keys(SYNCED_TABLES) as SyncedTable[]).filter(table => table !== 'api_tokens');

export const insightRoutes: Route[] = [
	route({
		method: 'GET',
		path: '/weight-trend',
		tag: 'Insights',
		summary: 'The daily trend weight, with its weekly rate and projection',
		description:
			"MacroFactor's Weight Trend V1 over the weigh-ins logged in the app or here: an exponential moving average with gaps interpolated. The Dashboard also merges Apple Health weigh-ins, which never reach the server, so the numbers match it only when every weigh-in is logged in the app. Pass `tz` so a weigh-in lands on the day the phone puts it on.",
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
		summary: 'The daily energy expenditure (TDEE) estimate, by the algorithm the Dashboard and the check-in use',
		description:
			'Recomputed from the app weigh-ins (not Apple Health), the food log, the plans, the imported steps (not Apple Health), and `settings.nutrition.expenditure` on every call, so an edit to a past day is reflected at once.',
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
		path: '/maintenance',
		tag: 'Insights',
		summary: 'The maintenance estimate Strategy sets targets from, with how it was reached',
		description:
			"The stretches of the log dense enough to measure (60% of days logged and six weigh-ins in any three weeks, less each stretch's first two weeks), each moved to today's trend weight, steps, and workouts, and pooled with the BMR or initial-estimate prior by inverse variance. `incomplete` lists the counted days left out as almost certainly incomplete, which `GET /expenditure` skips too. Like the other insights it reads the app's weigh-ins and imported steps, not Apple Health, so it can differ from the phone's. A static expenditure in the settings replaces it in the app.",
		query: z.object({ tz: M.timeZone }),
		response: M.MaintenanceEstimate,
		run({ db, query, now }) {
			const { today, result } = maintenanceFor(db, query.tz, now);
			return { today, estimate: result };
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
