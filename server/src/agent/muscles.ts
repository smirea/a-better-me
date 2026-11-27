import { z } from "zod";
import { CATALOG_EXERCISES, exerciseLookup, type Exercise } from "./catalog";
import { muscleSets, statsByExercise } from "./metrics";
import * as M from "./models";
// @ts-expect-error TypeScript types a `.ts` import as the module; Bun and the Worker bundle import it as its text.
import modelSource from "./muscle-model.ts" with { type: "text" };
import {
  fatigue,
  MUSCLES,
  READY_AT,
  RECOVERY_HALF_LIFE_HOURS,
  recovery,
  type LoadEvent,
  type Muscle,
} from "./muscle-model";
import { route, type Route } from "./route";

const LOWER_BODY = new Set<Muscle>([
  "quads",
  "glutes",
  "hamstrings",
  "calves",
  "abductors",
  "adductors",
  "tibs",
  "hip_flexors",
]);

const SUMMARY = `Load: each working set (any set but a warm-up; a drop or myo set counts once) gives each of the exercise's primaryMuscles 1 set and each of its secondaryMuscles 0.5. A workout's load is the sum over its exercises: the "sets per muscle" every body map in the app shows. A body map fills a muscle 0.35 + 0.65 * min(sets / fullAt, 1) of the way to full blue, fullAt being 4 on a program day, 3 on Workout Complete, and 10 for Levels' weekly average.
Recovery: each workout's load decays exponentially, halving every recoveryHalfLifeHours of the muscle (24 h for big muscles, 18 h for medium ones, 12 h for small ones and the trunk). Fatigue is the sum left over every past workout, and recovery is max(0, 1 - fatigue / 10), 1 meaning fresh. A muscle below ${READY_AT} is not ready to train hard. The app itself shows no recovery; this model is the API's.`;

const round = (value: number) => Math.round(value * 100) / 100;
const rounded = (map: Partial<Record<string, number>>) =>
  Object.fromEntries(Object.entries(map).map(([key, value]) => [key, round(value!)]));

/** Fatigue more than two weeks old is under a thousandth of its load, even at the longest half-life. */
const RECOVERY_WINDOW_MS = 14 * 24 * 3_600_000;

export const muscleRoutes: Route[] = [
  route({
    method: "GET",
    path: "/muscle-effects",
    tag: "Exercises",
    summary: "Every exercise's muscles, and the formula for muscle load and recovery",
    description:
      "One call gives what an agent needs to compute a plan's effect on each muscle: the primary and secondary muscles of every catalog and custom exercise, each muscle's recovery half-life, and the TypeScript module the server runs, which imports nothing and can be run as is. Programs already carry the result as `muscleEffects`, and GET /muscle-recovery applies it to the logged workouts.",
    query: z.object({
      ids: z
        .string()
        .optional()
        .meta({ description: "Comma-separated exercise ids, to list only those." }),
    }),
    response: M.MuscleEffects,
    run({ db, query }) {
      const custom = db.all("custom_exercises").map((row) => row.exercise as Exercise);
      const wanted = query.ids && new Set(query.ids.split(",").map((id) => id.trim()));
      const all = [
        ...CATALOG_EXERCISES.map((exercise) => ({ exercise, custom: false })),
        ...custom.map((exercise) => ({ exercise, custom: true })),
      ];
      return {
        muscles: MUSCLES.map((id) => ({
          id,
          name: id
            .split("_")
            .map((word) => word[0]!.toUpperCase() + word.slice(1))
            .join(" "),
          lowerBody: LOWER_BODY.has(id),
          recoveryHalfLifeHours: RECOVERY_HALF_LIFE_HOURS[id],
        })),
        formula: { summary: SUMMARY, language: "typescript" as const, source: modelSource },
        exercises: all
          .filter(({ exercise }) => !wanted || wanted.has(exercise.id))
          .map(({ exercise, custom }) => ({
            id: exercise.id,
            name: exercise.name,
            custom,
            primaryMuscles: exercise.primaryMuscles,
            secondaryMuscles: exercise.secondaryMuscles,
          })),
      };
    },
  }),
  route({
    method: "GET",
    path: "/muscle-recovery",
    tag: "Insights",
    summary: "How recovered each muscle is now, from the logged workouts",
    description:
      "The formula GET /muscle-effects serves, over the logged working sets of the finished workouts of the two weeks before `at`. Pass `at` to read another moment, such as when the next workout is planned.",
    query: z.object({
      at: M.instant.optional().meta({ description: "The moment to read. Defaults to now." }),
    }),
    response: M.MuscleRecovery,
    run({ db, query, now }) {
      const at = query.at ?? now;
      const end = Date.parse(at);
      const lookup = exerciseLookup(db);
      const events: LoadEvent[] = db
        .all("workout_sessions", "ended_at IS NOT NULL")
        .filter((session) => {
          const ended = Date.parse(session.endedAt!);
          return ended <= end && ended > end - RECOVERY_WINDOW_MS;
        })
        .map((session) => ({
          at: Date.parse(session.endedAt!),
          load: muscleSets(statsByExercise(session.blocks as M.Blocks, lookup), lookup),
        }));
      const state = recovery(events, end);
      return {
        at,
        recovery: rounded(state),
        fatigueSets: rounded(fatigue(events, end)),
        underRecovered: MUSCLES.filter((muscle) => state[muscle] < READY_AT),
      };
    },
  }),
];
