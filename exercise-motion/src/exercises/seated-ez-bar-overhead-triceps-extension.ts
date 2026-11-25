import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Seated on a flat bench with no tall backrest, so the EZ bar can pass behind the head. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 0,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "neck.flex": 8,
  "hip.flex": 88,
  "knee.flex": 88,
};

const ARMS = {
  "clavicle.elev": 14,
  "clavicle.prot": 2,
  "shoulder.elev": 166,
  "shoulder.plane": 82,
  "shoulder.twist": 6,
  "forearm.pron": 42,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "seated-ez-bar-overhead-triceps-extension",
  catalogId: "32e5c6f170d8800b9e2ada4601772e3e",
  name: "Seated EZ Bar Overhead Triceps Extension",
  defaultLoadKg: 14,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Behind head", "Press", "Lockout"],
  tempo: { lower: 1.8, bottom: 0.3, raise: 1.4, top: 0.4 },
  station: {
    kind: "seated",
    seatY: 0.43,
    stanceX: 0.18,
    heelZ: 0.36,
    pinHead: false,
    frame: { type: "flat-bench", zHead: -0.7, zFoot: 0.28 },
  },
  apparatus: {
    kind: "barbell",
    style: "ez",
    gripX: 0.18,
    anchor: "press",
    alignWrists: false,
  },
  extraContacts: { bar: { head: 0.06, neck: 0.04 } },
  hints: {
    start: { ...SEAT, ...ARMS, "elbow.flex": 6 },
    end: { ...SEAT, ...ARMS, "elbow.flex": 126, "neck.flex": 16 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.05, 0.26, 0.0], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.05, 0.26, 0.0], 16, "xz"),
  ],
  checks: () => [
    checkFlatBack("Sit upright with the lower back and neck near neutral."),
    checkFeetPlanted("Keep both feet on the floor while seated."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows start straight overhead",
      "Press the bar overhead until the elbows are fully straightened and the bar is stacked above the shoulders.",
      "elbow_L.flex",
      "top",
      0,
      36,
    ),
    checkJointWithinAt(
      "elbows-bent",
      "Bar lowers behind the head",
      "Bend the elbows until they are fully flexed or the bar can lightly reach the upper back.",
      "elbow_L.flex",
      "bottom",
      105,
      145,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows extend the EZ bar overhead",
      "Straighten the elbows to return the bar overhead.",
      "elbow_L.flex",
      85,
    ),
  ],
});
