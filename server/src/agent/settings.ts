import { z } from 'zod';
import { SETTINGS_ID } from '../../../shared/db/schema';
import type { Db } from './db';
import * as M from './models';
import { stampSections } from './nutrition';
import { route, type Route } from './route';

/** Objects merge key by key and everything else replaces, as the app reads a settings tree over its defaults. */
function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
	const merged = { ...base };
	for (const [key, value] of Object.entries(patch)) {
		const current = merged[key];
		const nested = value && typeof value === 'object' && !Array.isArray(value);
		const into = current && typeof current === 'object' && !Array.isArray(current);
		merged[key] =
			nested && into ? deepMerge(current as Record<string, unknown>, value as Record<string, unknown>) : value;
	}
	return merged;
}

/** Swift writes a gym's `plateCalculator` key as `uuidString`, uppercase, while row ids are lowercase. */
function workoutPatch(current: Record<string, unknown>, patch: z.output<typeof M.SettingsPatch>['workout']) {
	if (!patch?.plateCalculator) return deepMerge(current, patch ?? {});
	const stored = (current.plateCalculator ?? {}) as Record<string, Record<string, unknown>>;
	const byGym = Object.fromEntries(Object.entries(stored).map(([gym, options]) => [gym.toUpperCase(), options]));
	for (const [gym, options] of Object.entries(patch.plateCalculator)) {
		byGym[gym.toUpperCase()] = { ...byGym[gym.toUpperCase()], ...options };
	}
	return deepMerge({ ...current, plateCalculator: byGym }, { ...patch, plateCalculator: byGym });
}
export function settings(db: Db): z.output<typeof M.Settings> {
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
		nutrition: (row?.nutrition as Record<string, unknown>) ?? {},
	};
}

export const settingsRoutes: Route[] = [
	route({
		method: 'GET',
		path: '/settings',
		tag: 'Settings',
		summary: 'Get the weight unit, rest defaults, profile, Workout settings, and Nutrition settings',
		response: M.Settings,
		run: ({ db }) => settings(db),
	}),
	route({
		method: 'PATCH',
		path: '/settings',
		tag: 'Settings',
		summary: 'Change the weight unit, rest defaults, profile, Workout settings, or Nutrition settings',
		description: '`profile`, `workout`, and `nutrition` merge into the stored ones.',
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
				profile: deepMerge(current.profile, body.profile ?? {}),
				nutrition: deepMerge(current.nutrition, body.nutrition ?? {}),
				workout: workoutPatch(current.workout, body.workout),
			};
			const stamps = body.nutrition?.mealSections ? stampSections(db, body.nutrition.mealSections) : [];
			const exists = db.get('settings', SETTINGS_ID);
			db.commit(
				...stamps,
				exists
					? db.patch('settings', SETTINGS_ID, values)
					: db.put('settings', { ...current, ...values, id: SETTINGS_ID }),
			);
			return settings(db);
		},
	}),
];
