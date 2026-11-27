/**
 * How training loads each muscle and how that load wears off. `GET /muscle-effects` serves this file verbatim, so it
 * imports nothing: an agent can save it and run it (Bun, Deno, or Node with type stripping) to try a program before
 * writing it. The load is the app's own count (`WorkoutMetrics.muscleSets`), the number behind every body map. The
 * app has no recovery model; the one below exists for agents and is recorded in docs/decisions/workouts.md.
 */

export const MUSCLES = [
  "chest",
  "front_delts",
  "side_delts",
  "rear_delts",
  "lats",
  "upper_back",
  "upper_traps",
  "lower_back",
  "neck",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "obliques",
  "serratus",
  "glutes",
  "quads",
  "hamstrings",
  "adductors",
  "abductors",
  "hip_flexors",
  "calves",
  "tibs",
] as const;
export type Muscle = (typeof MUSCLES)[number];
/** Sparse: a muscle the work does not touch is absent. */
export type MuscleMap = Partial<Record<Muscle, number>>;

/** An exercise's effect, as the catalog lists it. */
export type MuscleEffect = {
  primaryMuscles: readonly Muscle[];
  secondaryMuscles: readonly Muscle[];
};

export const PRIMARY_SHARE = 1;
export const SECONDARY_SHARE = 0.5;

/**
 * Sets per muscle: each working set gives its primary muscles 1 and its secondary muscles 0.5. A working set is any set
 * but a warm-up, and a drop or myo set counts once however many drops or mini-sets it has.
 */
export function muscleLoad(
  items: readonly { effect: MuscleEffect; workingSets: number }[],
): MuscleMap {
  const load: MuscleMap = {};
  for (const { effect, workingSets } of items) {
    if (workingSets <= 0) continue;
    for (const muscle of effect.primaryMuscles)
      load[muscle] = (load[muscle] ?? 0) + workingSets * PRIMARY_SHARE;
    for (const muscle of effect.secondaryMuscles)
      load[muscle] = (load[muscle] ?? 0) + workingSets * SECONDARY_SHARE;
  }
  return load;
}

/** The sets at which each of the app's body maps fills a muscle completely. */
export const BODY_MAP_FULL_AT = {
  programDay: 4,
  workoutSummary: 3,
  weeklyAverage: 10,
} as const;

/** How much of the body map's blue a muscle gets, 0 to 1: any load at all shows 0.35, full blue from `fullAt` sets. */
export function bodyMapFill(sets: number, fullAt: number) {
  return sets > 0 ? 0.35 + 0.65 * Math.min(sets / fullAt, 1) : 0;
}

/**
 * Hours for half of a muscle's fatigue to wear off. Big muscles trained with heavy compounds take about three days to
 * come back from a hard session, small ones and the trunk about a day and a half.
 */
export const RECOVERY_HALF_LIFE_HOURS: Record<Muscle, number> = {
  chest: 24,
  front_delts: 18,
  side_delts: 18,
  rear_delts: 18,
  lats: 24,
  upper_back: 24,
  upper_traps: 18,
  lower_back: 24,
  neck: 12,
  biceps: 18,
  triceps: 18,
  forearms: 12,
  abs: 12,
  obliques: 12,
  serratus: 12,
  glutes: 24,
  quads: 24,
  hamstrings: 24,
  adductors: 24,
  abductors: 18,
  hip_flexors: 18,
  calves: 12,
  tibs: 12,
};

/** The fatigue, in sets, that leaves a muscle at 0% recovered: about the most one session should give it. */
export const FATIGUE_CAPACITY_SETS = 10;
/** Recovered enough to train hard again. */
export const READY_AT = 0.8;

/** One workout's load at a moment, in milliseconds since the epoch. */
export type LoadEvent = { at: number; load: MuscleMap };

/** Sets of fatigue left at `at`: each workout's load halves every half-life. Workouts after `at` do not count. */
export function fatigue(events: readonly LoadEvent[], at: number): MuscleMap {
  const left: MuscleMap = {};
  for (const event of events) {
    const hours = (at - event.at) / 3_600_000;
    if (hours < 0) continue;
    for (const [muscle, sets] of Object.entries(event.load) as [Muscle, number][]) {
      left[muscle] = (left[muscle] ?? 0) + sets * 0.5 ** (hours / RECOVERY_HALF_LIFE_HOURS[muscle]);
    }
  }
  return left;
}

/** How recovered each muscle is at `at`, from 0 (at capacity) to 1 (fresh), for every muscle. */
export function recovery(events: readonly LoadEvent[], at: number): Record<Muscle, number> {
  const left = fatigue(events, at);
  return Object.fromEntries(
    MUSCLES.map((muscle) => [
      muscle,
      Math.max(0, 1 - (left[muscle] ?? 0) / FATIGUE_CAPACITY_SETS),
    ]),
  ) as Record<Muscle, number>;
}

export type ScheduledDay = {
  /** How recovered each muscle the day trains is when it starts. Empty on a rest day. */
  recoveryBefore: MuscleMap;
  /** The day's muscles below `READY_AT`. */
  underRecovered: Muscle[];
};

/**
 * Walks a schedule of daily loads (an empty map for a rest day), one calendar day apart and each trained at the same
 * hour, from fresh muscles. A program's run is every cycle's days in a row.
 */
export function scheduleRecovery(days: readonly MuscleMap[], hoursBetweenDays = 24): ScheduledDay[] {
  const events: LoadEvent[] = [];
  return days.map((load, index) => {
    const at = index * hoursBetweenDays * 3_600_000;
    const before = recovery(events, at);
    events.push({ at, load });
    const trained = (Object.keys(load) as Muscle[]).filter((muscle) => (load[muscle] ?? 0) > 0);
    return {
      recoveryBefore: Object.fromEntries(trained.map((muscle) => [muscle, before[muscle]])),
      underRecovered: trained.filter((muscle) => before[muscle] < READY_AT),
    };
  });
}
