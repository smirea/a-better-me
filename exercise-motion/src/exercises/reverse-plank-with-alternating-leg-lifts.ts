import { Vector3 } from "three";
import { buildExerciseSpec, sidedHints } from "../builders";
import { lockAngle, pin, plantFoot } from "../solver";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Reverse plank that alternates a straight-leg lift. Hips stay high. */
const BASE = {
  "root.y": 0.38,
  "root.z": 0.05,
  "root.pitch": -6,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 8,
  "hip.abd": 6,
  "clavicle.prot": -18,
  "clavicle.elev": -4,
  "shoulder.elev": 32,
  "shoulder.plane": 78,
  "shoulder.twist": -6,
  "elbow.flex": 8,
  "forearm.pron": 20,
  "wrist.flex": -28,
};

const BOTH = { "hip.flex": 8, "knee.flex": 12, "ankle.dorsi": 14 };
const LIFT = { "hip.flex": -16, "knee.flex": 10, "ankle.dorsi": 10 };
const DOWN = { "hip.flex": 8, "knee.flex": 12, "ankle.dorsi": 14 };

const BRIDGE = { ...BASE, ...BOTH };
const LEFT_UP = sidedHints("L", LIFT, DOWN, BASE);

export const spec = buildExerciseSpec({
  id: "reverse-plank-with-alternating-leg-lifts",
  catalogId: "2765c6f170d880f18fe7d3f722e98f57",
  name: "Reverse Plank With Alternating Leg Lifts",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "alternating",
  grip: "open",
  brace: true,
  cameraHint: { view: "Side" },
  phaseLabels: ["Lift", "Up", "Switch", "Other"],
  tempo: { lower: 1.1, bottom: 0.35, raise: 1.1, top: 0.3 },
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    pinSacrum: false,
    feetOnFloor: false,
  },
  stiffness: { hip: 5, knee: 6, shoulder: 10, elbow: 10, lumbar: 12, wrist: 6 },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "palmFlat_L", bodyweightShare: 0.22, grip: "press", direction: [0, 1, 0] },
      { anchor: "palmFlat_R", bodyweightShare: 0.22, grip: "press", direction: [0, 1, 0] },
      { anchor: "heel_L", bodyweightShare: 0.12, grip: "press", direction: [0, 1, 0] },
      { anchor: "heel_R", bodyweightShare: 0.12, grip: "press", direction: [0, 1, 0] },
    ],
  },
  extraGoals: (body) => [
    pin(body, "palmFlat_L", () => new Vector3(0.22, 0.045, -0.32), 44),
    pin(body, "palmFlat_R", () => new Vector3(-0.22, 0.045, -0.32), 44),
    ...plantFoot(body, "L", new Vector3(0.1, 0.11, 0.58), 0.08, 16),
    ...plantFoot(body, "R", new Vector3(-0.1, 0.11, 0.58), 0.08, 16),
    lockAngle(body, "ankle_L.dorsi", -2, 6),
    lockAngle(body, "ankle_R.dorsi", -2, 6),
  ],
  hints: { start: BRIDGE, end: LEFT_UP },
  checks: () => [
    checkFlatBack(
      "Keep the grounded leg in line with the torso and the hip bones level while one foot lifts.",
      14,
    ),
    checkNeutralNeck("Keep the neck near neutral."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "The arms keep pointing straight down through the whole set.",
      "elbow_L.flex",
      "top",
      -8,
      26,
    ),
    checkJointWithinAt(
      "knee-straight",
      "Lifted knee stays straight",
      "Lift the free foot with a straight knee, only as high as the hips stay level.",
      "knee_L.flex",
      "bottom",
      0,
      20,
    ),
    checkJointRange(
      "leg-lifts",
      "One straight leg lifts, then the other",
      "Shift onto one heel, lift the other foot, lower it, and switch.",
      "hip_L.flex",
      8,
    ),
  ],
});
