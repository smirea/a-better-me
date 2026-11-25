import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
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
  "clavicle.prot": -16,
  "clavicle.elev": 0,
};

const ARMS_TOP = {
  "shoulder.elev": 96,
  "shoulder.plane": 68,
  "shoulder.twist": 28,
  "elbow.flex": 8,
  "forearm.pron": 28,
  "wrist.flex": -6,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 52,
  "shoulder.plane": 6,
  "shoulder.twist": 12,
  "elbow.flex": 108,
  "forearm.pron": 36,
  "wrist.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "decline-pause-dumbbell-press",
  catalogId: "1a05c6f170d88025ae85dd6b7d9f417e",
  name: "Decline Pause Dumbbell Press",
  defaultLoadKg: 14,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Pause"],
  tempo: { lower: 2, bottom: 2, raise: 1.15, top: 0.45 },
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
    anchor: "press",
    handPath: { start: [0.28, 1.02, -0.4], end: [0.3, 0.7, -0.28] },
  },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.7, elbow: 4, hip: 2, knee: 2, lumbar: 8, thoracic: 6, neck: 4, clavicle: 3.5 },
  extraGoals: (body) => [
    pin(body, "ankle_L", () => new Vector3(0.12, 0.38, 0.42), 22),
    pin(body, "ankle_R", () => new Vector3(-0.12, 0.38, 0.42), 22),
  ],
  extraContacts: {
    "bench.rollerTop": { shank_L: 0.06, shank_R: 0.06 },
    "bench.rollerLow": { shank_L: 0.06, shank_R: 0.06 },
  },
  checks: () => [
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked out",
      "Finish with the elbows straight over the shoulders.",
      "elbow_L.flex",
      "start",
      0,
      36,
    ),
    checkJointWithinAt(
      "pause",
      "Paused on the lower chest",
      "Pause about two seconds with the dumbbells at the bottom.",
      "elbow_L.flex",
      "peak",
      85,
      130,
    ),
    checkAnchorTravel(
      "dumbbells-rise",
      "Dumbbells travel up after the pause",
      "Press up from a dead stop on the decline.",
      "press_L",
      "y",
      0.14,
    ),
  ],
});
