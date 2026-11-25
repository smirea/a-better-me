import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { pin, plantFoot } from "../solver";
import { platformBox } from "../equipment-library";

/** Weight hangs on the free side, opposite the stance leg that does the hiking. */
const FREE_ARM = {
  "shoulder.elev": 8,
  "shoulder.plane": 10,
  "elbow.flex": 6,
  "forearm.pron": 8,
  "wrist.flex": 0,
};

const STANCE_ARM = {
  "shoulder.elev": 14,
  "shoulder.plane": 16,
  "elbow.flex": 10,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.x": 0.02,
  "root.y": 1.04,
  "root.pitch": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 4,
};

const STANCE_LEG = { "hip.flex": 4, "knee.flex": 4, "ankle.dorsi": 2 };
const FREE = { "hip.flex": 6, "hip.abd": 8, "knee.flex": 4, "ankle.dorsi": 16, "hip.rot": 0 };

export const spec = buildExerciseSpec({
  id: "weighted-hip-hike",
  catalogId: "34b5c6f170d8800b97a0fb798f6b4148",
  name: "Weighted Hip Hike",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Drop", "Low", "Hike", "High"],
  tempo: { lower: 1.3, bottom: 0.2, raise: 1.3, top: 0.25 },
  station: { kind: "cardio", machine: "none" },
  extraEquipment: platformBox("step.box", [0.08, 0, 0.02], 0.24, 0.12, 0.36),
  apparatus: { kind: "dumbbells", sides: ["R"] },
  stiffness: { knee: 12, hip: 4, lumbar: 10, elbow: 8, ankle: 4 },
  extraGoals: (body) => [
    ...plantFoot(body, "L", new Vector3(0.08, 0.12, 0.02), 0.04, 50),
    pin(body, "pelvisBottom", () => new Vector3(0.06, 1.02, 0.02), 28, "xz"),
  ],
  hints: {
    start: sidedHints("L", { ...STANCE_LEG, "hip.abd": 4, ...STANCE_ARM }, { ...FREE, ...FREE_ARM }, TRUNK),
    end: sidedHints("L", { ...STANCE_LEG, "hip.abd": 16, ...STANCE_ARM }, { ...FREE, ...FREE_ARM }, TRUNK),
  },
  checks: () => [
    checkFlatBack("Keep the torso upright and move only at the hip.", 12),
    checkJointWithinAt(
      "weight-arm",
      "Weight hangs straight",
      "Hold the dumbbell by the free side with a straight elbow.",
      "elbow_R.flex",
      "peak",
      0,
      20,
    ),
    checkJointWithinAt(
      "stance-knee",
      "Stance knee stays straight",
      "Keep the leg on the step straight while the loaded free hip drops and hikes.",
      "knee_L.flex",
      "bottom",
      0,
      16,
    ),
    checkJointRange(
      "hike",
      "Stance hip hikes the free side",
      "Drop the free hip, then hike it above the stance hip without bending the knees.",
      "hip_L.abd",
      5,
    ),
  ],
});
