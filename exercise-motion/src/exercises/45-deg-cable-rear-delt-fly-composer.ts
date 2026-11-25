import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Both pulleys above the head. Arms cross high, then sweep down and out together. */
const STANCE = {
  ...POSTURE_HINTS.standing,
  "root.z": -0.16,
  "knee.flex": 8,
  "hip.flex": 4,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": -4,
};

const HIGH = {
  "shoulder.elev": 96,
  "shoulder.plane": 88,
  "shoulder.twist": 6,
  "elbow.flex": 20,
  "forearm.pron": 16,
  "wrist.flex": 0,
  "clavicle.elev": 14,
  "clavicle.prot": 4,
};

const LOW = {
  "shoulder.elev": 58,
  "shoulder.plane": 8,
  "shoulder.twist": 4,
  "elbow.flex": 18,
  "forearm.pron": 14,
  "wrist.flex": 0,
  "clavicle.elev": 6,
  "clavicle.prot": -10,
};

export const spec = buildExerciseSpec({
  id: "45-deg-cable-rear-delt-fly-composer",
  catalogId: "2a15c6f170d88066b38fd65f8757716f",
  name: "45° Cable Rear Delt Fly (composer)",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Sweep", "Low", "Return", "High cross"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: {
    kind: "cable-dual",
    pulleyY: 1.62,
    halfWidth: 0.88,
    z: 0.38,
    attachment: "d-handle",
    anchor: "grip",
  },
  stiffness: { elbow: 6, shoulder: 2.2, lumbar: 8 },
  hints: {
    start: { ...STANCE, ...HIGH },
    end: { ...STANCE, ...LOW },
  },
  glb: [{ id: "dualadjustablepulley-composer", pos: [0, 0, 0.38], hideEquipment: true }],
  checks: () => [
    checkFlatBack("Keep the torso upright with the chest up. The arms move at the shoulders."),
    checkJointWithinAt(
      "hands-high",
      "Hands start above the shoulders",
      "Start with the arms crossed and the hands above shoulder height, in line with the high cables.",
      "shoulder_L.elev",
      "start",
      78,
      125,
    ),
    checkJointWithinAt(
      "soft-elbows",
      "Elbows stay slightly bent",
      "Maintain slightly bent elbows throughout the set.",
      "elbow_L.flex",
      "peak",
      6,
      40,
    ),
    checkJointWithinAt(
      "low-finish",
      "Elbows finish out and back",
      "Finish with the elbows about level with the shoulders or slightly behind them.",
      "shoulder_L.plane",
      "peak",
      -16,
      28,
    ),
    checkJointRange(
      "diagonal",
      "Arms sweep down and out",
      "Sweep the arms equally outward and downward, then let them cross back up.",
      "shoulder_L.elev",
      28,
    ),
  ],
});