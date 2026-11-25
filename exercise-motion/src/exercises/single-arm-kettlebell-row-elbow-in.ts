import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { box } from "../equipment";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { pin } from "../solver";

const BENCH_TOP = 0.5;
const BENCH_X = -0.28;

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.x": 0.18,
  "root.y": 0.82,
  "root.z": 0.02,
  "root.pitch": 72,
  "lumbar.flex": 4,
  "thoracic.flex": 6,
  "neck.flex": -6,
};

const WORK_LEG = { "hip.flex": 70, "hip.abd": 8, "knee.flex": 28, "ankle.dorsi": 8 };
const BRACE_LEG = { "hip.flex": 88, "hip.abd": 6, "knee.flex": 95, "ankle.dorsi": 4 };

const ROW = {
  "shoulder.twist": -6,
  "forearm.pron": 0,
  "wrist.flex": 2,
  "shoulder.plane": 78,
};

const BRACE_ARM = {
  "shoulder.elev": 62,
  "shoulder.plane": 40,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 20,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": 4,
};

export const spec = buildExerciseSpec({
  id: "single-arm-kettlebell-row-elbow-in",
  catalogId: "1a15c6f170d880f09425c9edd56d2d73",
  name: "Single Arm Kettlebell Row (Elbow-In)",
  defaultLoadKg: 16,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Row", "Hip", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.45, top: 0.3 },
  station: { kind: "standing", stanceX: 0.28, heelZ: -0.05, singleFoot: "L", torsoLeanDeg: 68, balanceZ: -0.02 },
  apparatus: { kind: "kettlebells", sides: ["L"], hangVertical: true },
  extraEquipment: [
    box("brace.pad", [BENCH_X, BENCH_TOP - 0.04, 0.32], [0.28, 0.08, 0.42], "pad"),
    box("knee.pad", [BENCH_X, 0.42, -0.28], [0.26, 0.08, 0.32], "pad"),
    box("brace.post", [BENCH_X, 0.18, 0.05], [0.06, 0.36, 0.06], "steel", false),
  ],
  extraContacts: {
    "brace.pad": { hand_R: 0.08, forearm_R: 0.05 },
    "knee.pad": { shank_R: 0.06, thigh_R: 0.05 },
  },
  extraGoals: (body) => [
    pin(body, "grip_R", () => new Vector3(BENCH_X, BENCH_TOP + 0.02, 0.32), 32),
    pin(body, "kneeFront_R", () => new Vector3(BENCH_X, 0.48, -0.28), 26),
  ],
  hints: {
    start: sidedHints(
      "L",
      { ...ROW, ...WORK_LEG, "shoulder.elev": 48, "shoulder.plane": 62, "elbow.flex": 8, "clavicle.prot": 4, "clavicle.elev": 4 },
      { ...BRACE_ARM, ...BRACE_LEG },
      HINGE,
    ),
    end: sidedHints(
      "L",
      { ...ROW, ...WORK_LEG, "shoulder.elev": 28, "elbow.flex": 112, "clavicle.prot": -16, "clavicle.elev": 8 },
      { ...BRACE_ARM, ...BRACE_LEG },
      HINGE,
    ),
  },
  checks: () => [
    checkFlatBack("Keep your torso close to parallel to the ground with a flat lower back, not a rounded one."),
    checkNeutralNeck("Keep your chest facing a similar direction. A mild twist is fine; do not turn this into a cheat row."),
    checkJointRange(
      "elbow-in-row",
      "Elbow drives back toward the hip",
      "Drive your elbow backward and upward in an arc, tucked by your side, to pull the kettlebell toward your hip.",
      "elbow_L.flex",
      65,
    ),
    checkJointWithinAt(
      "neutral",
      "Neutral grip",
      "Keep your palm facing in toward the opposite side of your body for the whole set.",
      "forearm_L.pron",
      "start",
      -30,
      30,
    ),
    checkJointWithinAt(
      "hang",
      "Working arm hangs straight",
      "Let the working arm hang down toward the ground with a straight elbow before you row.",
      "elbow_L.flex",
      "start",
      0,
      28,
    ),
    checkJointWithinAt(
      "tucked",
      "Elbow stays tucked",
      "Keep the elbow tucked by your side rather than flaring it outward. Finish aligned with the torso or slightly behind it.",
      "elbow_L.flex",
      "peak",
      90,
      140,
    ),
  ],
});
