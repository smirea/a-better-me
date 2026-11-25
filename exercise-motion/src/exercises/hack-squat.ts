import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Back on the 45° carriage, shoulders under the pads, feet mid-plate. */
const CARRIAGE = {
  "root.y": 0.88,
  "root.z": -0.05,
  "root.pitch": -28,
  "hip.abd": 12,
  "hip.rot": 8,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
  "clavicle.elev": 8,
  "shoulder.elev": 28,
  "shoulder.plane": 18,
  "shoulder.twist": 6,
  "elbow.flex": 48,
  "forearm.pron": 24,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "hack-squat",
  catalogId: "1a25c6f170d88008a9adde9f71881c36",
  name: "Hack Squat",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 2, bottom: 0.3, raise: 1.4, top: 0.45 },
  station: { kind: "hack-squat", angleDeg: 45, stanceX: 0.17 },
  apparatus: { kind: "none" },
  extraContacts: {
    "hack.footPlate": { shank_L: 0.08, shank_R: 0.08, foot_L: 0.05, foot_R: 0.05 },
  },
  stiffness: { knee: 3.4, hip: 2, ankle: 1.4 },
  hints: {
    start: { ...CARRIAGE, "hip.flex": 32, "knee.flex": 14, "ankle.dorsi": 8 },
    end: { ...CARRIAGE, "root.y": 0.62, "hip.flex": 92, "knee.flex": 104, "ankle.dorsi": 16 },
  },
  checks: () => [
    checkFlatBack("Keep the back and the back of the hips snug on the back pad."),
    checkNeutralNeck("Keep the neck near neutral, head on the pad or just off it."),
    checkJointWithinAt(
      "knees-straight",
      "Knees finish straight",
      "Stand the carriage up until the knees are straight or only slightly bent.",
      "knee_L.flex",
      "start",
      4,
      26,
    ),
    checkJointWithinAt(
      "depth",
      "Knees bend past 90 degrees",
      "Squat until the knees are bent by at least 90 degrees, heels flat on the foot plate.",
      "knee_L.flex",
      "peak",
      85,
      125,
    ),
    checkJointRange(
      "knee-rom",
      "Knee extension is the prime motion",
      "Bend and straighten the knees to ride the angled carriage, with the hips sharing the squat.",
      "knee_L.flex",
      75,
    ),
  ],
});
