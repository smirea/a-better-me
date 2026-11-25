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
  "shoulder.twist": 8,
  "forearm.pron": 40,
  "wrist.flex": 4,
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
  id: "single-arm-dumbbell-row-elbow-out",
  catalogId: "2a55c6f170d880f6aa9ed2abe35b5215",
  name: "Single Arm Dumbbell Row (Elbow-Out)",
  defaultLoadKg: 14,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Row", "Flare", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.45, top: 0.3 },
  station: { kind: "standing", stanceX: 0.28, heelZ: -0.05, singleFoot: "L", torsoLeanDeg: 68, balanceZ: -0.02 },
  apparatus: { kind: "dumbbells", sides: ["L"] },
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
      { ...ROW, ...WORK_LEG, "shoulder.elev": 48, "shoulder.plane": 68, "elbow.flex": 8, "clavicle.prot": 2, "clavicle.elev": 4 },
      { ...BRACE_ARM, ...BRACE_LEG },
      HINGE,
    ),
    end: sidedHints(
      "L",
      { ...ROW, ...WORK_LEG, "shoulder.elev": 34, "shoulder.plane": 18, "elbow.flex": 104, "clavicle.prot": -14, "clavicle.elev": 10 },
      { ...BRACE_ARM, ...BRACE_LEG },
      HINGE,
    ),
  },
  checks: () => [
    checkFlatBack("Keep your torso close to parallel to the ground with a flat lower back."),
    checkNeutralNeck("Keep your chest facing a similar direction. A mild twist is fine; do not turn this into a cheat row."),
    checkJointRange(
      "elbow-out-row",
      "Elbow arcs back and out",
      "Drive your elbow backward, upward, and about 45 degrees out from your side.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "hybrid",
      "Hybrid overhand grip",
      "Angle your palm between facing backward and facing in, and keep that grip.",
      "forearm_L.pron",
      "start",
      15,
      65,
    ),
    checkJointWithinAt(
      "flare",
      "Elbow finishes flared",
      "Finish with the elbow about level with the torso, flared about 45 degrees from your side.",
      "shoulder_L.plane",
      "peak",
      8,
      28,
    ),
  ],
});
