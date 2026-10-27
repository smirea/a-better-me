import type { z } from 'zod';
import type { Exercise } from './catalog';
import type * as M from './models';

/**
 * `WorkoutMetrics` and `SessionRecords` from the iOS app, so an agent reads the sets, volume, and 1-RM the app shows.
 * A set is done once it has a `log`; warm-ups count toward volume but not toward sets or records.
 */

type WorkoutSet = z.output<typeof M.WorkoutSet>;
type Lookup = (id: string) => Exercise | undefined;

/** Epley on reps to failure (reps + RIR), the app's stand-in for MacroFactor's unpublished estimate. */
export const estimatedOneRepMaxKg = (weightKg: number, reps: number, rir: number | undefined) => {
	const toFailure = reps + (rir ?? 0);
	return toFailure <= 1 ? weightKg : weightKg * (1 + toFailure / 30);
};

/** Weight times reps over a set and its sub-rows, doubled per side. Assisted exercises have none. */
export function volumeKg(set: WorkoutSet, exercise: Exercise) {
	if (exercise.metrics.includes('assistanceWeight')) return 0;
	const total = [set.log, ...set.subSets.map(sub => sub.log)].reduce(
		(sum, log) => sum + (log?.weightKg ?? 0) * (log?.reps ?? 0),
		0,
	);
	return exercise.metrics.some(metric => metric.includes('PerSide')) ? total * 2 : total;
}

export type ExerciseStats = {
	exerciseID: string;
	name: string;
	loggedSets: number;
	workingSets: number;
	volumeKg: number;
	bestReps: number | null;
	bestEstimatedOneRepMaxKg: number | null;
};

/** `SessionRecords.stats(of:)`, over every listing of the exercise in the blocks. */
function exerciseStats(sets: WorkoutSet[], exercise: Exercise): ExerciseStats {
	const stats: ExerciseStats = {
		exerciseID: exercise.id,
		name: exercise.name,
		loggedSets: 0,
		workingSets: 0,
		volumeKg: 0,
		bestReps: null,
		bestEstimatedOneRepMaxKg: null,
	};
	for (const set of sets) {
		if (!set.log) continue;
		stats.volumeKg += volumeKg(set, exercise);
		stats.loggedSets += 1;
		if (set.type === 'warmUp') continue;
		stats.workingSets += 1;
		const { reps, weightKg, rir } = set.log;
		if (reps === undefined) continue;
		stats.bestReps = Math.max(stats.bestReps ?? 0, reps);
		if (weightKg && weightKg > 0) {
			const estimate = estimatedOneRepMaxKg(weightKg, reps, rir);
			stats.bestEstimatedOneRepMaxKg = Math.max(stats.bestEstimatedOneRepMaxKg ?? 0, estimate);
		}
	}
	return stats;
}

/** The logged sets of each exercise, an exercise listed twice counting once, in the session's order. */
export function statsByExercise(blocks: M.Blocks, lookup: Lookup): ExerciseStats[] {
	const sets = new Map<string, WorkoutSet[]>();
	for (const item of blocks.flatMap(block => block.exercises)) {
		sets.set(item.exerciseID, [...(sets.get(item.exerciseID) ?? []), ...item.sets]);
	}
	return [...sets].flatMap(([id, itemSets]) => {
		const exercise = lookup(id);
		const stats = exercise && exerciseStats(itemSets, exercise);
		return stats?.loggedSets ? [stats] : [];
	});
}

/** `WorkoutMetrics.muscleSets` over logged sets: a primary muscle counts 1 per working set, a secondary 0.5. */
export function muscleSets(stats: ExerciseStats[], lookup: Lookup) {
	const sets: Record<string, number> = {};
	for (const { exerciseID, workingSets } of stats) {
		const exercise = lookup(exerciseID)!;
		for (const muscle of exercise.primaryMuscles) sets[muscle] = (sets[muscle] ?? 0) + workingSets;
		for (const muscle of exercise.secondaryMuscles) sets[muscle] = (sets[muscle] ?? 0) + workingSets * 0.5;
	}
	return sets;
}

type SessionLike = { startedAt: string; endedAt: string | null; pausedSeconds: number; blocks: unknown };

export function sessionStats(session: SessionLike, lookup: Lookup) {
	const exercises = statsByExercise(session.blocks as M.Blocks, lookup);
	const elapsed = session.endedAt ? (Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 1000 : null;
	return {
		durationSeconds: elapsed === null ? null : Math.max(0, Math.round(elapsed - session.pausedSeconds)),
		workingSets: exercises.reduce((sum, e) => sum + e.workingSets, 0),
		volumeKg: exercises.reduce((sum, e) => sum + e.volumeKg, 0),
		muscleSets: muscleSets(exercises, lookup),
		exercises,
	};
}
