import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { pin, plantFoot } from "../solver";

/** Same low-pulley cuff as the behind-the-body variation, but the working thigh stays in front of the stance leg. */
const ARMS_FREE = {
  "shoulder.elev": 12,
  "shoulder.plane": 16,
  "elbow.flex": 10,
};

const HOLD = {
  "shoulder.elev": 26,
  "shoulder.plane": 6,
  "elbow.flex": 16,
  "forearm.pron": 16,
  "wrist.flex": 0,
};

const STANCE = {
  ...POSTURE_HINTS.standing,
  "root.x": -0.12,
  "root.y": 0.96,
  "root.pitch": 4,
  "root.roll": -4,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 4,
};

const WORK = { "hip.flex": 26, "knee.flex": 4, "ankle.dorsi": 20, "hip.rot": 0 };
const STANCE_LEG = { "hip.flex": 6, "hip.abd": 6, "knee.flex": 6, "ankle.dorsi": 4 };

export const spec = buildExerciseSpec({
  id: "cable-hip-abduction-leg-in-front-of-body",
  catalogId: "1a35c6f170d8809484d3fbed0a740f30",
  name: "Cable Hip Abduction (Leg In Front Of Body)",
  defaultLoadKg: 5,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "open",
  phaseLabels: ["Sweep out", "Out", "Return", "Crossed"],
  tempo: { lower: 1.3, bottom: 0.2, raise: 1.4, top: 0.25 },
  station: { kind: "cardio", machine: "none" },
  apparatus: {
    kind: "cable-single",
    pulley: [-0.95, 0.22, 0.18],
    columnPos: [-1.05, 0.08],
    facingDir: 1,
    attachment: "ankle-cuff",
    anchor: "ankleCuff_L",
    sides: ["L"],
  },
  stiffness: { knee: 10, lumbar: 8, hip: 4, ankle: 4 },
  extraGoals: (body) => [
    ...plantFoot(body, "R", new Vector3(-0.1, 0, -0.02), 0.04, 48),
    pin(body, "grip_R", () => new Vector3(-0.48, 1.12, 0.1), 14),
  ],
  hints: {
    start: sidedHints("L", { ...WORK, "hip.abd": -16 }, { ...STANCE_LEG, ...HOLD }, {
      ...STANCE,
      ...ARMS_FREE,
    }),
    end: sidedHints("L", { ...WORK, "hip.abd": 32 }, { ...STANCE_LEG, ...HOLD }, {
      ...STANCE,
      ...ARMS_FREE,
    }),
  },
  checks: () => [
    checkFlatBack(
      "Keep the hips and shoulders level, with the chest and belt buckle pointing straight ahead.",
      12,
    ),
    checkJointWithinAt(
      "knee-straight",
      "Working knee stays straight",
      "Sweep the working leg with a straight knee while the stance leg holds you up.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
    checkJointWithinAt(
      "in-front",
      "Working thigh stays in front",
      "Let the leg pass in front of the stance leg as it sweeps toward the pulley.",
      "hip_L.flex",
      "peak",
      10,
      34,
    ),
    checkJointRange(
      "abduction",
      "Leg abducts out to the side",
      "Drive the leg straight out to the side, then let it sweep back across the midline.",
      "hip_L.abd",
      24,
    ),
  ],
});
