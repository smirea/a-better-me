import { platformBox } from "../equipment-library";
import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { keepAbove, pin } from "../solver";
import { Vector3 } from "three";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const ARMS = {
  "clavicle.elev": 8,
  "shoulder.elev": 82,
  "shoulder.plane": 74,
  "shoulder.twist": -18,
  "elbow.flex": 8,
  "forearm.pron": 22,
  "wrist.flex": 0,
};

const STANCE = { "hip.flex": 8, "hip.abd": 4, "knee.flex": 6, "ankle.dorsi": 3 };
const FREE_UP = { "hip.flex": 42, "hip.abd": 6, "knee.flex": 8, "ankle.dorsi": 6 };
const STANCE_DOWN = { "hip.flex": 88, "hip.abd": 8, "hip.rot": 4, "knee.flex": 96, "ankle.dorsi": 16 };
const FREE_DOWN = { "hip.flex": 78, "hip.abd": 10, "knee.flex": 16, "ankle.dorsi": 8 };

export const spec = buildExerciseSpec({
  id: "bodyweight-single-leg-box-squat",
  catalogId: "1ff5c6f170d8809fb1eee51d32c9316b",
  name: "Bodyweight Single Leg Box Squat",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "open",
  phaseLabels: ["Lower", "Sit", "Stand", "Top"],
  tempo: { lower: 2, bottom: 0.6, raise: 1.6, top: 0.4 },
  station: { kind: "standing", singleFoot: "L", stanceX: 0.04, heelZ: 0.08, trackKnees: 10, balanceZ: 0.1 },
  apparatus: { kind: "none" },
  extraEquipment: platformBox("squat.box", [0, 0, -0.28], 0.46, 0.46, 0.34, "wood"),
  extraContacts: { "squat.box": { pelvis: 0.06, thigh_L: 0.04, thigh_R: 0.04 } },
  hints: {
    start: sidedHints("L", STANCE, FREE_UP, {
      ...POSTURE_HINTS.standing,
      "root.z": 0.02,
      "root.pitch": 4,
      "lumbar.flex": 0,
      "thoracic.flex": 0,
      "neck.flex": 2,
      ...ARMS,
    }),
    end: sidedHints("L", STANCE_DOWN, FREE_DOWN, {
      ...POSTURE_HINTS.standing,
      "root.y": 0.62,
      "root.x": 0.02,
      "root.z": -0.06,
      "root.pitch": 24,
      "lumbar.flex": 8,
      "thoracic.flex": 6,
      "neck.flex": 6,
      ...ARMS,
    }),
  },
  progress: (body, frame) => anchorPoint(body, frame, "pelvisBottom").y,
  extraGoals: (body) => [
    pin(body, "pelvisBottom", () => new Vector3(0.05, 0, 0), 50, "x"),
    keepAbove(body, "heel_R", 0.06, 60),
    keepAbove(body, "toe_R", 0.04, 40),
  ],
  checks: () => [
    checkFlatBack(
      "Through motion at your working leg’s hip, your torso should naturally transition to an inclined position.",
      18,
    ),
    checkFeetPlanted(
      "Keep the entirety of your working leg’s foot firmly in contact with the ground throughout your set.",
      ["L"],
    ),
    checkJointWithinAt(
      "free-leg",
      "Free leg stays lifted",
      "Lift your other foot up off the ground by lifting that side’s leg up with a mostly straight knee.",
      "knee_R.flex",
      "bottom",
      0,
      30,
    ),
    checkJointRange(
      "sit",
      "Sit to the box",
      "Continue to squat down until you can sit onto the box in a controlled manner.",
      "knee_L.flex",
      55,
    ),
    checkJointWithinAt(
      "pause",
      "Paused on the box",
      "Briefly pause on the box as your body remains visibly stationary for at least a moment.",
      "hip_L.flex",
      "bottom",
      70,
      120,
    ),
    checkAnchorTravel(
      "depth",
      "Single-leg box squat lowers",
      "Progressively bend at your knee and hip to sit back in a controlled manner.",
      "pelvisBottom",
      "y",
      0.18,
    ),
  ],
});
