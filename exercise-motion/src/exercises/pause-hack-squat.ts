import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

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
  id: "pause-hack-squat",
  catalogId: "29c5c6f170d880278b3ec11248f37c9f",
  name: "Pause Hack Squat",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Pause", "Press", "Lockout"],
  tempo: { lower: 2, bottom: 1.8, raise: 1.4, top: 0.4 },
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
    checkFlatBack("Stay tight on the back pad through the pause. Do not let the hips peel off."),
    checkNeutralNeck("Keep the neck near neutral during the pause and the press."),
    checkJointWithinAt(
      "paused-depth",
      "Pause at the bottom",
      "Hold completely still for about one to two seconds at the deepest knee bend you can keep with the heels down.",
      "knee_L.flex",
      "peak",
      90,
      130,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Knees finish straight after the pause",
      "After the pause, drive the carriage up until the knees are straight or only slightly bent.",
      "knee_L.flex",
      "start",
      4,
      26,
    ),
    checkJointRange(
      "knee-rom",
      "Full squat around the pause",
      "Lower under control, pause, then extend the knees and hips together.",
      "knee_L.flex",
      75,
    ),
  ],
});
