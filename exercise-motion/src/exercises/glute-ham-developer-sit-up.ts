import { buildExerciseSpec } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Arms crossed, each hand on the opposite shoulder. */
const ARMS = {
  "shoulder.elev": 46,
  "shoulder.plane": 76,
  "shoulder.twist": 40,
  "elbow.flex": 126,
  "forearm.pron": 18,
  "wrist.flex": 6,
  "clavicle.elev": 4,
};

/** Torso leaned back toward the rollers, lower back mildly arched. */
const BACK = {
  "root.y": 0.98,
  "root.z": 0.02,
  "root.pitch": -72,
  "hip.flex": 18,
  "hip.abd": 6,
  "knee.flex": 22,
  "ankle.dorsi": 12,
  "lumbar.flex": -12,
  "thoracic.flex": -6,
  "neck.flex": 2,
  ...ARMS,
};

/** Curled up until the shoulders stack over the hips. */
const UP = {
  ...BACK,
  "root.y": 1.08,
  "root.z": 0.16,
  "root.pitch": -6,
  "hip.flex": 88,
  "knee.flex": 22,
  "lumbar.flex": 28,
  "thoracic.flex": 24,
  "neck.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "glute-ham-developer-sit-up",
  catalogId: "1a35c6f170d880f3acdbd86f5b83b29a",
  name: "Glute Ham Developer Sit-Up",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  brace: true,
  phaseLabels: ["Lean", "Extend", "Curl", "Up"],
  station: { kind: "ghd", padY: 0.96 },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 18, thoracic: 16, hip: 2, root: 3 },
  hints: { start: BACK, end: UP },
  checks: () => [
    checkJointRange(
      "trunk-curl",
      "Back rounds as the torso rises",
      "To train your abs dynamically, your back should progressively round rather than remain in a flat position.",
      "lumbar.flex",
      20,
    ),
    checkJointRange(
      "hip-drive",
      "Hips flex as the shoulders rise over the hips",
      "Reverse the lean by curling your back until your shoulders are vertically above your hips.",
      "hip_L.flex",
      32,
    ),
    checkJointRange(
      "thoracic-round",
      "Upper back rounds at the top",
      "Drive the bottom of your ribs down toward the tops of your hip bones while tightening your abs.",
      "thoracic.flex",
      16,
    ),
    checkJointWithinAt(
      "knees-soft",
      "Knees stay slightly bent",
      "Select a footplate height that lets you feel secure with slightly bent knees once you are in position.",
      "knee_L.flex",
      "peak",
      15,
      140,
    ),
    checkNeutralNeck(
      "Your neck should be near a neutral position, like when you are normally standing upright, looking straight ahead.",
      20,
    ),
  ],
});
