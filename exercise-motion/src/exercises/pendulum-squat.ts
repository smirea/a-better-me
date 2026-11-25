import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Steeper carriage than a 45° hack: the arc of a pendulum squat, feet on a fixed plate. */
const CARRIAGE = {
  "root.y": 0.98,
  "root.z": -0.28,
  "root.pitch": -18,
  "hip.abd": 12,
  "hip.rot": 8,
  "lumbar.flex": 3,
  "thoracic.flex": 2,
  "neck.flex": 2,
  "clavicle.elev": 8,
  "shoulder.elev": 26,
  "shoulder.plane": 16,
  "shoulder.twist": 6,
  "elbow.flex": 44,
  "forearm.pron": 22,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "pendulum-squat",
  catalogId: "1a25c6f170d8800b8768c160b4808e67",
  name: "Pendulum Squat",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 2, bottom: 0.3, raise: 1.4, top: 0.45 },
  station: { kind: "hack-squat", angleDeg: 62, stanceX: 0.17 },
  apparatus: { kind: "none" },
  extraContacts: {
    "hack.footPlate": { shank_L: 0.08, shank_R: 0.08, foot_L: 0.05, foot_R: 0.05 },
  },
  stiffness: { knee: 3.4, hip: 2, ankle: 1.4 },
  hints: {
    start: { ...CARRIAGE, "hip.flex": 28, "knee.flex": 12, "ankle.dorsi": 6 },
    end: { ...CARRIAGE, "root.y": 0.64, "hip.flex": 88, "knee.flex": 100, "ankle.dorsi": 14 },
  },
  checks: () => [
    checkFlatBack("Keep the whole back snug on the back pad as the carriage swings down."),
    checkNeutralNeck("Keep the neck near neutral under or just off the shoulder pads."),
    checkJointWithinAt(
      "knees-straight",
      "Knees finish straight",
      "Drive the feet into the plate until the knees are straight or only slightly bent.",
      "knee_L.flex",
      "start",
      2,
      24,
    ),
    checkJointWithinAt(
      "depth",
      "Deep knee bend",
      "Squat until the knees are bent by at least 90 degrees, heels flat on the foot plate.",
      "knee_L.flex",
      "peak",
      90,
      132,
    ),
    checkJointRange(
      "knee-rom",
      "Pendulum knee travel",
      "Bend the knees and hips together on the way down, then extend them to stand the carriage back up.",
      "knee_L.flex",
      75,
    ),
  ],
});
