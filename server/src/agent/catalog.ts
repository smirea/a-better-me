import type { z } from 'zod';
import equipmentJson from '../../../app-ios/Sources/App/Resources/Catalog/equipment.json';
import exercisesJson from '../../../app-ios/Sources/App/Resources/Catalog/exercises.json';
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

export const catalogExercise = (id: string) => BY_ID.get(id);
