import { Vector3 } from "three";
import { buildExerciseSpec, sidedHints } from "../builders";
import { checkAnchorTravel, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

const TRUNK = {
  "root.y": 0.58,
  "root.z": 0.08,
  "root.pitch": -96,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "neck.flex": 4,
  "hip.flex": 18,
  "hip.abd": 8,
  "hip.rot": 4,
  "knee.flex": 100,
  "ankle.dorsi": 8,
  "clavicle.prot": -14,
  "clavicle.elev": 0,
};

const PRESS_TOP = {
  "shoulder.elev": 96,
  "shoulder.plane": 68,
  "shoulder.twist": 28,
  "elbow.flex": 8,
  "forearm.pron": 28,
  "wrist.flex": -6,
  "clavicle.prot": -16,
  "clavicle.elev": 0,
};

const PRESS_BOTTOM = {
  "shoulder.elev": 52,
  "shoulder.plane": 6,
  "shoulder.twist": 12,
  "elbow.flex": 108,
  "forearm.pron": 36,
  "wrist.flex": -8,
  "clavicle.prot": -16,
  "clavicle.elev": 0,
};

const FREE = {
  "shoulder.elev": 30,
  "shoulder.plane": 24,
  "shoulder.twist": 6,
  "elbow.flex": 96,
  "forearm.pron": 14,
  "wrist.flex": 4,
  "clavicle.prot": -6,
  "clavicle.elev": 2,
};

export const spec = buildExerciseSpec({
  id: "decline-single-arm-dumbbell-press",
  catalogId: "1a05c6f170d88061a44edbcda249b9d4",
  name: "Decline Single Arm Dumbbell Press",
  defaultLoadKg: 14,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Lower chest"],
  tempo: { lower: 2, bottom: 0.25, raise: 1.2, top: 0.45 },
  station: {
    kind: "lying",
    surface: "adjustable-bench",
    face: "up",
    backAngleDeg: -18,
    ankleRollers: true,
    feetOnFloor: false,
  },
  apparatus: {
    kind: "dumbbells",
    sides: ["L"],
    anchor: "press",
    handPath: { start: [0.3, 1.02, -0.4], end: [0.32, 0.72, -0.28] },
  },
  hints: {
    start: { ...TRUNK, ...sidedHints("L", PRESS_TOP, FREE) },
    end: { ...TRUNK, ...sidedHints("L", PRESS_BOTTOM, FREE) },
  },
  stiffness: { shoulder: 0.7, elbow: 4, hip: 2, knee: 2, lumbar: 8, thoracic: 6, neck: 4, clavicle: 3.5 },
  extraGoals: (body) => [
    pin(body, "ankle_L", () => new Vector3(0.12, 0.38, 0.42), 22),
    pin(body, "ankle_R", () => new Vector3(-0.12, 0.38, 0.42), 22),
  ],
  extraContacts: {
    "bench.rollerTop": { shank_L: 0.08, shank_R: 0.08 },
    "bench.rollerLow": { shank_L: 0.06, shank_R: 0.06 },
  },
  checks: () => [
    checkJointWithinAt(
      "elbow-locked",
      "Working elbow locked out",
      "Finish with the working arm straight over the shoulder.",
      "elbow_L.flex",
      "start",
      0,
      36,
    ),
    checkJointWithinAt(
      "lower-chest",
      "Dumbbell meets the lower chest",
      "Lower the working dumbbell toward the lower chest.",
      "elbow_L.flex",
      "peak",
      85,
      130,
    ),
    checkAnchorTravel(
      "dumbbell-rises",
      "Dumbbell travels up",
      "Press the single dumbbell up from the lower chest.",
      "press_L",
      "y",
      0.12,
    ),
  ],
});
