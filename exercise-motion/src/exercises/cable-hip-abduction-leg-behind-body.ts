import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { keepAbove, pin, plantFoot } from "../solver";

/** Low pulley on the right. Left ankle cuff. Stance leg is slightly in front so the working leg sweeps behind it. */
const ARMS_FREE = {
  "shoulder.elev": 12,
  "shoulder.plane": 16,
  "elbow.flex": 10,
};

const HOLD = {
  "shoulder.elev": 28,
  "shoulder.plane": 8,
  "elbow.flex": 18,
  "forearm.pron": 16,
  "wrist.flex": 0,
};

const STANCE = {
  ...POSTURE_HINTS.standing,
  "root.x": -0.12,
  "root.y": 0.96,
  "root.pitch": 14,
  "root.roll": -4,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 6,
};

const WORK = { "hip.flex": 32, "knee.flex": 12, "ankle.dorsi": 28, "hip.rot": 0 };
const STANCE_LEG = { "hip.flex": 12, "hip.abd": 6, "knee.flex": 10, "ankle.dorsi": 6 };

export const spec = buildExerciseSpec({
  id: "cable-hip-abduction-leg-behind-body",
  catalogId: "1a35c6f170d8806dac95e1ab4fa67605",
  name: "Cable Hip Abduction (Leg Behind Body)",
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
    pulley: [-0.95, 0.22, -0.05],
    columnPos: [-1.05, -0.16],
    facingDir: 1,
    attachment: "ankle-cuff",
    anchor: "ankleCuff_L",
    sides: ["L"],
  },
  stiffness: { knee: 10, lumbar: 8, hip: 4, ankle: 4 },
  extraGoals: (body) => [
    ...plantFoot(body, "R", new Vector3(-0.1, 0, 0.06), 0.04, 48),
    pin(body, "grip_R", () => new Vector3(-0.48, 1.12, 0.08), 14),
    keepAbove(body, "heel_L", 0.02, 40),
    keepAbove(body, "ballIn_L", 0.02, 40),
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
      "Sweep the working leg with a straight knee, like the hand of a clock around the hip.",
      "knee_L.flex",
      "peak",
      0,
      28,
    ),
    checkJointWithinAt(
      "crossed-start",
      "Leg starts across the body",
      "Let the cable draw the working leg inward, passing slightly behind the stance leg.",
      "hip_L.abd",
      "start",
      -24,
      -4,
    ),
    checkJointRange(
      "abduction",
      "Leg abducts out to the side",
      "Drive the leg straight out to the side through the hip’s available range, then return under control.",
      "hip_L.abd",
      24,
    ),
  ],
});
