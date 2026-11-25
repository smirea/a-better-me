import { buildExerciseSpec } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Fingertips at the sides of the head, elbows wide. */
const ARMS = {
  "shoulder.elev": 62,
  "shoulder.plane": 48,
  "shoulder.twist": 28,
  "elbow.flex": 118,
  "forearm.pron": -10,
  "wrist.flex": 6,
  "clavicle.elev": 4,
};

const BACK = {
  "root.y": 0.98,
  "root.z": 0.02,
  "root.pitch": -74,
  "hip.flex": 16,
  "hip.abd": 6,
  "knee.flex": 22,
  "ankle.dorsi": 6,
  "lumbar.flex": -12,
  "thoracic.flex": -4,
  "neck.flex": 4,
  ...ARMS,
};

const UP = {
  ...BACK,
  "root.y": 1.08,
  "root.z": 0.16,
  "root.pitch": -4,
  "hip.flex": 88,
  "knee.flex": 22,
  "lumbar.flex": 30,
  "thoracic.flex": 26,
  "neck.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "glute-ham-developer-sit-up-with-hands-behind-head",
  catalogId: "1a35c6f170d880678e8cfcf2ec99f9ea",
  name: "Glute Ham Developer Sit-Up With Hands Behind Head",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  brace: true,
  phaseLabels: ["Lean", "Extend", "Curl", "Up"],
  station: { kind: "ghd", padY: 0.96 },
  apparatus: { kind: "none" },
  tempo: { lower: 2.2, bottom: 0.35, raise: 2.0, top: 0.45 },
  stiffness: { lumbar: 18, thoracic: 16, hip: 2, knee: 4, ankle: 4, root: 3 },
  extraContacts: {
    "ghd.footPlate": { shank_L: 0.04, shank_R: 0.04 },
  },
  hints: { start: BACK, end: UP },
  checks: () => [
    checkJointRange(
      "trunk-curl",
      "Back rounds as the torso rises",
      "To train your abs dynamically, your back should progressively round rather than remain in a flat position.",
      "lumbar.flex",
      16,
    ),
    checkJointRange(
      "hip-drive",
      "Hips flex until the shoulders stack over the hips",
      "Curl your back to lift the torso until your shoulders are vertically above your hips.",
      "hip_L.flex",
      24,
    ),
    checkJointWithinAt(
      "hands-stay-wide",
      "Elbows stay out away from the sides",
      "Place the fingertips lightly on the sides of the back of the head and keep the upper arms directed out away from the sides.",
      "elbow_L.flex",
      "peak",
      90,
      140,
    ),
    checkJointWithinAt(
      "knees-soft",
      "Knees stay slightly bent in the rollers",
      "Hook the lower legs between the rollers so the knees stay slightly bent and the feet cannot slide.",
      "knee_L.flex",
      "start",
      15,
      140,
    ),
    checkNeutralNeck(
      "Keep the neck near a neutral position and the hands relaxed, rather than pulling on the head.",
      22,
    ),
  ],
});
