import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Plates tap the floor and reverse immediately, so the bottom hold is only a touch. */
const ARMS = {
  "shoulder.plane": 72,
  "shoulder.twist": 10,
  "elbow.flex": 6,
  "forearm.pron": 76,
  "wrist.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "touch-and-go-conventional-deadlift",
  catalogId: "2285c6f170d880d3b0e7c4fbfb5da392",
  name: "Touch-And-Go Conventional Deadlift",
  defaultLoadKg: 32,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Tap", "Stand", "Lockout"],
  tempo: { lower: 1.1, bottom: 0.08, raise: 1.15, top: 0.25 },
  station: { kind: "standing", stanceX: 0.12, toeOutDeg: 6 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    path: { startY: 0.8, startZ: 0.14, endY: 0.24, endZ: 0.24, arcBulgeZ: 0.08 },
  },
  extraContacts: { bar: { shank_L: 0.03, shank_R: 0.03, thigh_L: 0.03, thigh_R: 0.03 } },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 10, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.74,
      "root.z": -0.02,
      "root.pitch": 36,
      "hip.flex": 88,
      "hip.abd": 4,
      "knee.flex": 74,
      "ankle.dorsi": 18,
      "shoulder.elev": 18,
      "lumbar.flex": 4,
      "thoracic.flex": 6,
      "neck.flex": -4,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your lower back flat and your chest up as the plates touch the floor and you reverse the pull.",
      16,
    ),
    checkNeutralNeck("Keep your neck near neutral instead of looking up or tucking your chin as you tap."),
    checkJointRange(
      "full-pull",
      "Full conventional pull",
      "Stand in approximately a hip-width stance with the bar over the middle of your feet.",
      "hip_L.flex",
      55,
    ),
    checkJointWithinAt(
      "floor-knees",
      "Knees bent at the tap",
      "Sit your hips back and bend your knees until your hands reach the bar on the floor.",
      "knee_L.flex",
      "bottom",
      50,
      105,
    ),
    checkJointWithinAt(
      "lockout",
      "Stand tall between taps",
      "Thrust your hips forward until you are standing fully upright before you descend into the next touch.",
      "hip_L.flex",
      "start",
      0,
      28,
    ),
  ],
});
