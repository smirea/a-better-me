import { bodyRoutes } from './body';
import type { Db } from './db';
import { planOn } from './engine';
import { exerciseRoutes } from './exercises';
import { gymRoutes } from './gyms';
import { expenditureFor, insightRoutes } from './insights';
import { logDays, nutritionRoutes } from './nutrition';
import { programDetail, programRoutes } from './programs';
import type { Route } from './route';
import { settings, settingsRoutes } from './settings';
import { workoutRoutes } from './workouts';
import { foodRoutes } from '../food/routes';

/** Every operation: the router dispatches on this list and the OpenAPI document is generated from it. */
export const agentRoutes = (keys: { geminiApiKey: string | null }): Route[] => [
	...exerciseRoutes,
	...workoutRoutes,
	...programRoutes,
	...gymRoutes,
	...settingsRoutes,
	...bodyRoutes,
	...nutritionRoutes,
	...insightRoutes,
	...foodRoutes(keys),
];

/** What the authenticated root returns besides the docs: enough state that an agent knows where things stand. */
export function snapshot(db: Db, timeZone: string, now: string) {
	const active = db.all('programs', 'active = 1 ORDER BY updated_at DESC')[0];
	const defaultGym = db.all('gym_profiles', 'is_default = 1 ORDER BY updated_at DESC')[0];
	const inProgress = db.all('workout_sessions', 'ended_at IS NULL')[0];
	const last = db.all('workout_sessions', 'ended_at IS NOT NULL ORDER BY started_at DESC LIMIT 1')[0];
	const count = (table: Parameters<Db['count']>[0]) => db.count(table);
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
			foods: count('foods'),
			recipes: count('recipes'),
			foodEntries: count('food_entries'),
			nutritionPlans: count('nutrition_plans'),
		},
		lastFoodLogDay: db.all('food_entries', '1 ORDER BY day DESC LIMIT 1')[0]?.day ?? null,
		...nutritionState(db, timeZone, now),
	};
}

function nutritionState(db: Db, timeZone: string, now: string) {
	const { today, trend, result } = expenditureFor(db, timeZone, now);
	const latest = db.all('body_weights', '1 ORDER BY measured_at DESC LIMIT 1')[0];
	const log = logDays(db, { from: today, to: today })[0];
	const placed = planOn(db.all('nutrition_plans'), today);
	return {
		today,
		timeZone,
		latestWeighIn: latest ? { measuredAt: latest.measuredAt, weightKg: latest.weightKg } : null,
		trendWeightKg: trend.at(-1)?.trendKg ?? null,
		expenditure: result.strategy ? { kcal: result.days.at(-1)!.kcal, strategy: result.strategy } : null,
		nutritionToday: {
			planId: placed?.plan.id ?? null,
			target: placed?.target ?? null,
			consumed: log?.consumed ?? {},
			entryCount: log?.entryCount ?? 0,
		},
	};
}
