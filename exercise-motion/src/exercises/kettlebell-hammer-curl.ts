import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Both hands on the horns, palms in, bell in front of the thighs. */
const ARMS = {
  "shoulder.elev": 24,
  "shoulder.plane": 72,
  "shoulder.twist": 6,
  "forearm.pron": 6,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "kettlebell-hammer-curl",
  catalogId: "1a95c6f170d880db929ad4f53f8ec4a8",
  name: "Kettlebell Hammer Curl",
  defaultLoadKg: 12,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Thighs"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: { kind: "kettlebells", twoHandsOnOne: true },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.08, -0.28, 0.1], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.08, -0.28, 0.1], 16, "xz"),
  ],
  stiffness: { elbow: 1.2, shoulder: 3, lumbar: 8 },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "elbow.flex": 10 },
    end: { ...POSTURE_HINTS.standing, ...ARMS, "elbow.flex": 130 },
  },
  checks: () => [
    checkFlatBack(
      "Curl the kettlebell by bending the elbows while the legs and torso stay still.",
    ),
    checkJointWithinAt(
      "palms-in",
      "Palms face in on the horns",
      "Place one hand on each horn with the palms facing in toward each other.",
      "forearm_L.pron",
      "start",
      -25,
      30,
    ),
    checkJointWithinAt(
      "arms-long",
      "Elbows start extended in front of the thighs",
      "Hold the kettlebell in front of the thighs with the elbows straight and the upper arms slightly in front of the torso.",
      "elbow_L.flex",
      "start",
      40,
      80,
    ),
    checkJointWithinAt(
      "curled",
      "Elbows finish flexed",
      "Curl the kettlebell upward until the elbows are fully flexed.",
      "elbow_L.flex",
      "peak",
      110,
      150,
    ),
    checkJointRange(
      "elbow-flexion",
      "Elbows flex through the hammer curl",
      "After the elbows flex, lower the kettlebell until they are extended again.",
      "elbow_L.flex",
      40,
    ),
  ],
});
