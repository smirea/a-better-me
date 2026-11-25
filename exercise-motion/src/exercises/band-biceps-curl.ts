import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Standing on a long band, palms up, upper arms fixed at the sides. */
const ARMS = {
  "shoulder.elev": 16,
  "shoulder.plane": 48,
  "shoulder.twist": -16,
  "forearm.pron": -76,
  "wrist.flex": 4,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "band-biceps-curl",
  catalogId: "3315c6f170d8805189f3df9113d267f0",
  name: "Band Biceps Curl",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Arms long"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: {
    kind: "band",
    anchors: [
      [-0.16, 0.02, 0.04],
      [0.16, 0.02, 0.04],
    ],
  },
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
    checkFlatBack("Stand on the middle of a long band and curl without swinging the torso."),
    checkJointWithinAt(
      "arms-long",
      "Elbows start extended",
      "Start standing on the band with the arms long and the palms facing forward.",
      "elbow_L.flex",
      "start",
      0,
      24,
    ),
    checkJointWithinAt(
      "curled",
      "Elbows finish flexed",
      "Curl the hands up toward the shoulders by bending the elbows.",
      "elbow_L.flex",
      "peak",
      110,
      150,
    ),
    checkJointRange(
      "elbow-flexion",
      "Elbows flex against the band",
      "Curl upward, then lower until the elbows are extended again.",
      "elbow_L.flex",
      90,
    ),
    checkJointWithinAt(
      "supinated",
      "Palms stay up",
      "Keep an underhand grip so the palms face forward through the curl.",
      "forearm_L.pron",
      "peak",
      -85,
      -40,
    ),
  ],
});
