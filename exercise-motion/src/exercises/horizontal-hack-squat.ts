import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Fully reclined pin-loaded hack: the carriage runs nearly horizontal and the lifter presses away from a fixed plate. */
const RECLINED = {
  "root.y": 0.55,
  "root.z": -0.15,
  "root.pitch": -18,
  "hip.abd": 12,
  "hip.rot": 6,
  "lumbar.flex": 3,
  "thoracic.flex": 1,
  "neck.flex": 4,
  "clavicle.elev": 6,
  "shoulder.elev": 24,
  "shoulder.plane": 12,
  "shoulder.twist": 8,
  "elbow.flex": 40,
  "forearm.pron": 22,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "horizontal-hack-squat",
  catalogId: "3575c6f170d880b4a611eae88e33ed83",
  name: "Horizontal Hack Squat",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 2, bottom: 0.3, raise: 1.4, top: 0.4 },
  station: { kind: "hack-squat", angleDeg: 12, stanceX: 0.16 },
  apparatus: { kind: "none" },
  extraContacts: {
    "hack.footPlate": { shank_L: 0.08, shank_R: 0.08, foot_L: 0.05, foot_R: 0.05 },
  },
  stiffness: { knee: 3.2, hip: 2.2, ankle: 1.4 },
  hints: {
    start: { ...RECLINED, "hip.flex": 40, "knee.flex": 32, "ankle.dorsi": 10 },
    end: { ...RECLINED, "root.z": -0.02, "hip.flex": 82, "knee.flex": 88, "ankle.dorsi": 12 },
  },
  checks: () => [
    checkFlatBack("Keep the back and the back of the hips against the fully reclined pad."),
    checkNeutralNeck("Keep the neck near neutral, head on the pad or just off it."),
    checkJointWithinAt(
      "knees-straight",
      "Knees finish straight",
      "Press yourself away from the platform until the knees are straight or only slightly bent.",
      "knee_L.flex",
      "start",
      18,
      48,
    ),
    checkJointWithinAt(
      "depth",
      "Knees bend through the available range",
      "Bend the knees and hips back toward the platform without rounding the lower back or lifting the heels.",
      "knee_L.flex",
      "peak",
      70,
      115,
    ),
    checkJointRange(
      "knee-rom",
      "Knee extension on a horizontal carriage",
      "The motion is a squat along a nearly horizontal backrest, driven by the knees with the hips assisting.",
      "knee_L.flex",
      40,
    ),
  ],
});
