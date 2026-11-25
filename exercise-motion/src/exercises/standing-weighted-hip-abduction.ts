import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { plantFoot } from "../solver";
import { Vector3 } from "three";

/** Lean into the stance side. Dumbbell hangs on the outer working thigh. */
const STANCE_ARM = {
  "shoulder.elev": 78,
  "shoulder.plane": 4,
  "elbow.flex": 8,
  "forearm.pron": 20,
  "wrist.flex": 0,
};

const WEIGHT_ARM = {
  "shoulder.elev": 22,
  "shoulder.plane": 28,
  "elbow.flex": 8,
  "forearm.pron": 16,
  "wrist.flex": 0,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.x": -0.1,
  "root.y": 0.98,
  "root.pitch": 2,
  "root.roll": 0,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 4,
};

const STANCE_LEG = { "hip.flex": 6, "hip.abd": 4, "knee.flex": 6, "ankle.dorsi": 2 };
const WORK = { "hip.flex": 14, "knee.flex": 4, "ankle.dorsi": 18, "hip.rot": 2 };

export const spec = buildExerciseSpec({
  id: "standing-weighted-hip-abduction",
  catalogId: "2e85c6f170d88097a650f71960adf734",
  name: "Standing Weighted Hip Abduction",
  defaultLoadKg: 3,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Sweep out", "Out", "Lower", "In"],
  tempo: { lower: 1.2, bottom: 0.2, raise: 1.3, top: 0.25 },
  station: { kind: "cardio", machine: "none" },
  extraGoals: (body) => [...plantFoot(body, "R", new Vector3(-0.08, 0, 0.02), 0.02, 50)],
  apparatus: { kind: "dumbbells", sides: ["L"] },
  stiffness: { knee: 10, hip: 4, lumbar: 8, elbow: 8 },
  hints: {
    start: sidedHints("L", { ...WORK, "hip.abd": 4, ...WEIGHT_ARM }, { ...STANCE_LEG, ...STANCE_ARM }, TRUNK),
    end: sidedHints("L", { ...WORK, "hip.abd": 34, ...WEIGHT_ARM }, { ...STANCE_LEG, ...STANCE_ARM }, TRUNK),
  },
  checks: () => [
    checkFlatBack(
      "Keep the torso still and in line with the stance leg. Do not hike the hip or bend to the side.",
      12,
    ),
    checkJointWithinAt(
      "knee-straight",
      "Working knee stays straight",
      "Sweep the working leg out with the kneecap and toes pointing straight ahead.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
    checkJointWithinAt(
      "no-rotation",
      "Working thigh does not turn out",
      "Do not rotate the leg so the toes angle toward the direction of the lift.",
      "hip_L.rot",
      "peak",
      -12,
      14,
    ),
    checkJointRange(
      "abduction",
      "Leg abducts",
      "Sweep the working leg straight out to the side, then lower it back in beside the stance leg.",
      "hip_L.abd",
      16,
    ),
  ],
});
