import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { pin, plantFoot } from "../solver";
import { platformBox } from "../equipment-library";

/**
 * Stance foot on a low step. Dropping stance-hip abduction lets the free hip fall;
 * hiking it back up is closed-chain hip abduction of the stance leg.
 */
const ARMS = {
  "shoulder.elev": 12,
  "shoulder.plane": 14,
  "elbow.flex": 8,
  "forearm.pron": 10,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.x": 0.02,
  "root.y": 1.04,
  "root.pitch": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 4,
  ...ARMS,
};

const STANCE_LEG = { "hip.flex": 4, "knee.flex": 4, "ankle.dorsi": 2 };
const FREE = { "hip.flex": 6, "hip.abd": 8, "knee.flex": 4, "ankle.dorsi": 16, "hip.rot": 0 };

export const spec = buildExerciseSpec({
  id: "hip-hike",
  catalogId: "3255c6f170d8804a961bf94a911bdc1c",
  name: "Hip Hike",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "open",
  phaseLabels: ["Drop", "Low", "Hike", "High"],
  tempo: { lower: 1.2, bottom: 0.2, raise: 1.2, top: 0.25 },
  station: { kind: "cardio", machine: "none" },
  extraEquipment: platformBox("step.box", [0.08, 0, 0.02], 0.24, 0.12, 0.36),
  apparatus: { kind: "none" },
  stiffness: { knee: 12, hip: 4, lumbar: 10, ankle: 4 },
  extraGoals: (body) => [
    ...plantFoot(body, "L", new Vector3(0.08, 0.12, 0.02), 0.04, 50),
    pin(body, "pelvisBottom", () => new Vector3(0.06, 1.02, 0.02), 28, "xz"),
  ],
  hints: {
    start: sidedHints("L", { ...STANCE_LEG, "hip.abd": 4 }, FREE, TRUNK),
    end: sidedHints("L", { ...STANCE_LEG, "hip.abd": 16 }, FREE, TRUNK),
  },
  checks: () => [
    checkFlatBack("Keep the torso upright and move only at the hip.", 12),
    checkJointWithinAt(
      "stance-knee",
      "Stance knee stays straight",
      "Keep the leg on the step straight while the free hip drops and hikes.",
      "knee_L.flex",
      "bottom",
      0,
      16,
    ),
    checkJointWithinAt(
      "free-knee",
      "Free knee stays straight",
      "Keep the free leg straight and the toes pulled up so they do not catch the floor.",
      "knee_R.flex",
      "bottom",
      0,
      16,
    ),
    checkJointRange(
      "hike",
      "Stance hip hikes the free side",
      "Let the free hip drop below level, then hike it until that hip bone is higher than the stance hip.",
      "hip_L.abd",
      5,
    ),
  ],
});
