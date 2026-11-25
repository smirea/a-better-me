import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Palms forward, a kettlebell in each hand. */
const ARMS = {
  "shoulder.elev": 14,
  "shoulder.plane": 42,
  "shoulder.twist": -18,
  "forearm.pron": -76,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "standing-dual-kettlebell-biceps-curl",
  catalogId: "1a15c6f170d8809a927ed538bf683443",
  name: "Standing Dual Kettlebell Biceps Curl",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Sides"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.18, toeOutDeg: 8 },
  apparatus: { kind: "kettlebells", sides: ["L", "R"], hangVertical: true },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.05, -0.3, 0.04], 18, "xz"),
    holdElbowNearShoulder(body, "R", [0.05, -0.3, 0.04], 18, "xz"),
  ],
  stiffness: { elbow: 1.2, shoulder: 3, lumbar: 8 },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "elbow.flex": 8 },
    end: { ...POSTURE_HINTS.standing, ...ARMS, "elbow.flex": 132 },
  },
  checks: () => [
    checkFlatBack("Stand upright and curl both kettlebells without swinging the torso."),
    checkJointWithinAt(
      "underhand",
      "Palms face forward",
      "Direct the palms so they face forward, and keep that underhand grip.",
      "forearm_L.pron",
      "start",
      -85,
      -40,
    ),
    checkJointWithinAt(
      "arms-long",
      "Elbows start extended at the sides",
      "Hold the kettlebells at your sides with the elbows extended.",
      "elbow_L.flex",
      "start",
      0,
      24,
    ),
    checkJointWithinAt(
      "curled",
      "Elbows finish flexed",
      "Curl both kettlebells upward by bending the elbows.",
      "elbow_L.flex",
      "peak",
      110,
      150,
    ),
    checkJointRange(
      "elbow-flexion",
      "Both elbows flex",
      "After the elbows fully flex, lower the kettlebells until the elbows are extended again.",
      "elbow_L.flex",
      90,
    ),
  ],
});
