import type { z } from 'zod';
import equipmentJson from '../../../app-ios/Sources/App/Resources/Catalog/equipment.json';
import exercisesJson from '../../../app-ios/Sources/App/Resources/Catalog/exercises.json';
import type { Db } from './db';
import type { StoredExercise } from './models';

/**
 * The bundled catalog the app ships, read from the iOS resources so the server never holds a second copy that could
 * drift. Catalog exercises are read-only; the owner's own live in `custom_exercises`.
 */

export type Exercise = z.output<typeof StoredExercise>;
export type Equipment = { id: string; name: string; category: string; weightOptionsKg: number[] } & Record<
	string,
	unknown
>;

export const CATALOG_EXERCISES = exercisesJson as unknown as Exercise[];
export const EQUIPMENT = equipmentJson as unknown as Equipment[];
export const EQUIPMENT_BY_ID = new Map(EQUIPMENT.map(item => [item.id, item]));
const BY_ID = new Map(CATALOG_EXERCISES.map(exercise => [exercise.id, exercise]));

/**
 * What a gym provides, as the app's `GymAvailability` decides it: a listed plural ("Dumbbells") also provides the
 * singular exercises name ("Dumbbell"), and Bodyweight items are never listed because every gym has them.
 */
export function gymProvides(listed: string[]) {
	const provided = new Set(listed);
	for (const id of listed) {
		const singular = EQUIPMENT_BY_ID.get(id)?.pluralOf;
		if (typeof singular === 'string') provided.add(singular);
	}
	for (const item of EQUIPMENT) if (item.category === 'Bodyweight') provided.add(item.id);
	return provided;
}

export const catalogExercise = (id: string) => BY_ID.get(id);

/** Catalog and custom exercises by id, reading the custom ones once per request. */
export function exerciseLookup(db: Db) {
	const custom = new Map(db.all('custom_exercises').map(row => [row.id, row.exercise as Exercise]));
	return (id: string) => BY_ID.get(id) ?? custom.get(id);
}
