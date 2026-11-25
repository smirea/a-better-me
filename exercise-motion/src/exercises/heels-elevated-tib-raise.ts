import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { platformBox } from "../equipment-library";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

const STEP = 0.16;

/** Heels on a step, forefeet hanging off, knees straight. */
const STAND = {
  ...POSTURE_HINTS.standing,
  "root.y": 1.08,
  "root.z": 0.02,
  "root.pitch": 2,
  "hip.flex": 4,
  "hip.abd": 6,
  "knee.flex": 4,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 4,
  "shoulder.elev": 28,
  "shoulder.plane": 30,
  "elbow.flex": 18,
};

export const spec = buildExerciseSpec({
  id: "heels-elevated-tib-raise",
  catalogId: "1a15c6f170d880e39adec8726186fa3f",
  name: "Heels-Elevated Tib Raise",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Lift", "Level", "Lower", "Toes down"],
  tempo: { lower: 1.4, bottom: 0.25, raise: 1.3, top: 0.3 },
  station: { kind: "cardio", machine: "none" },
  extraEquipment: platformBox("step.box", [0, 0, -0.1], 0.7, STEP, 0.18, "rubber"),
  extraContacts: { "step.box": { foot_L: 0.04, foot_R: 0.04, shank_L: 0.02, shank_R: 0.02 } },
  extraGoals: (body) => [
    pin(body, "heel_L", () => new Vector3(0.11, STEP, -0.04), 56),
    pin(body, "heel_R", () => new Vector3(-0.11, STEP, -0.04), 56),
  ],
  extraRequired: [
    { label: "Left heel on the step", anchor: "heel_L", surfaceY: STEP, allowSlide: true },
    { label: "Right heel on the step", anchor: "heel_R", surfaceY: STEP, allowSlide: true },
  ],
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "ballIn_L", bodyweightShare: 0.12, grip: "rest", direction: [0, -1, 0] },
      { anchor: "ballIn_R", bodyweightShare: 0.12, grip: "rest", direction: [0, -1, 0] },
    ],
  },
  stiffness: { ankle: 8, knee: 10, hip: 4 },
  hints: {
    start: { ...STAND, "ankle.dorsi": -32 },
    end: { ...STAND, "ankle.dorsi": 12 },
  },
  checks: () => [
    checkJointWithinAt(
      "knees-straight",
      "Knees stay straight",
      "Once on the step, your knees should be straight throughout this exercise.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
    checkJointWithinAt(
      "toes-down",
      "Forefeet start below the heels",
      "Allow the feet to point downward so the toes sit closer to the ground than the heels.",
      "ankle_L.dorsi",
      "start",
      -45,
      -12,
    ),
    checkJointWithinAt(
      "toes-up",
      "Forefeet finish level with the heels",
      "At the end of the lift, the balls of the feet should be about level with the heels or above them.",
      "ankle_L.dorsi",
      "peak",
      -2,
      28,
    ),
    checkJointRange(
      "ankle-dorsiflexion",
      "Ankles dorsiflex off the step",
      "Lift the balls of the feet upward away from the ground. Motion occurs only at the ankles.",
      "ankle_L.dorsi",
      24,
    ),
  ],
});
