import type { ExerciseSpec } from "../exercise";
import { barbellBenchPress } from "./barbell-bench-press";
import { dumbbellRomanianDeadlift } from "./dumbbell-romanian-deadlift";
import { smithMachineBackSquat } from "./smith-machine-back-squat";

export const EXERCISES: ExerciseSpec[] = [
  smithMachineBackSquat,
  dumbbellRomanianDeadlift,
  barbellBenchPress,
];
