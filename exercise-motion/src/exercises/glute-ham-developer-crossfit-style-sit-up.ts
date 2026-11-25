import { buildExerciseSpec } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Leaned back, arms out to the sides, knees softly bent. */
const SHARED = {
  "hip.abd": 6,
  "knee.flex": 22,
  "ankle.dorsi": 12,
  "elbow.flex": 14,
  "forearm.pron": 28,
  "wrist.flex": 0,
  "shoulder.twist": 8,
};

/** Leaned back with the arms out to the sides. */
const FLOOR = {
  ...SHARED,
  "root.y": 0.98,
  "root.z": 0.02,
  "root.pitch": -72,
  "hip.flex": 18,
  "lumbar.flex": -12,
  "thoracic.flex": -6,
  "neck.flex": 8,
  "shoulder.elev": 72,
  "shoulder.plane": 55,
};

/** Folded upright, arms reaching back toward the roller. */
const ROLLER = {
  ...SHARED,
  "root.y": 1.08,
  "root.z": 0.16,
  "root.pitch": -6,
  "hip.flex": 88,
  "lumbar.flex": 26,
  "thoracic.flex": 18,
  "neck.flex": 8,
  "shoulder.elev": 58,
  "shoulder.plane": 8,
};

export const spec = buildExerciseSpec({
  id: "glute-ham-developer-crossfit-style-sit-up",
  catalogId: "2755c6f170d880a6afc3c21185dce74d",
  name: "Glute Ham Developer CrossFit-Style Sit-Up",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  brace: true,
  phaseLabels: ["Reach", "Floor", "Whip", "Roller"],
  station: { kind: "ghd", padY: 0.96 },
  apparatus: { kind: "none" },
  tempo: { lower: 1.6, bottom: 0.2, raise: 1.2, top: 0.25 },
  stiffness: { lumbar: 14, thoracic: 12, hip: 1.6, knee: 5, ankle: 5, shoulder: 0.8, root: 3 },
  extraContacts: {
    "ghd.footPlate": { shank_L: 0.04, shank_R: 0.04 },
  },
  hints: { start: FLOOR, end: ROLLER },
  checks: () => [
    checkJointRange(
      "hip-whip",
      "Hips swing from extension to a deep tuck",
      "Most of the motion comes from leaning back at your hips, then lifting the torso up through the hip flexors until the hands touch the top roller.",
      "hip_L.flex",
      30,
    ),
    checkJointRange(
      "trunk-shift",
      "Back moves from an arch into a round",
      "Tighten the abs and drive the bottom of the ribs toward the hip bones so the back shifts from arched, to flat, to mildly rounded at the top.",
      "lumbar.flex",
      14,
    ),
    checkJointRange(
      "arms-reach",
      "Arms sweep from the floor up to the roller",
      "Reach the arms out away from the sides to touch the ground, then bring both hands to the top roller.",
      "shoulder_L.plane",
      18,
    ),
    checkJointWithinAt(
      "knees-bend-at-the-bottom",
      "Knees stay slightly bent while leaned back",
      "While keeping your knees slightly bent, lean back until the fingertips can touch the ground.",
      "knee_L.flex",
      "start",
      10,
      150,
    ),
    checkJointWithinAt(
      "knees-straighten-at-the-top",
      "Knees straighten as the hands hit the roller",
      "Straighten the knees and rapidly reverse the movement until you can touch the top roller with both hands.",
      "knee_L.flex",
      "peak",
      8,
      150,
    ),
  ],
});
