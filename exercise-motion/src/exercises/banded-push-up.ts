import { cylinder, IDENTITY } from "../equipment";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

const HANDS = {
  "root.z": 0,
  "root.pitch": 74,
  "shoulder.twist": 6,
  "forearm.pron": 75,
  "wrist.flex": -28,
  "hip.flex": 18,
  "hip.abd": 6,
  "knee.flex": 14,
  "ankle.dorsi": -8,
  "neck.flex": 8,
  "lumbar.flex": 0,
  "thoracic.flex": 0,
};

const LOADS = [
  { anchor: "palmFlat_L", bodyweightShare: 0.375, share: 0.375, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
  { anchor: "palmFlat_R", bodyweightShare: 0.375, share: 0.375, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
];

/** The builder cannot hang a live band off the hands and the upper back together with bodyweight loads. */
const BAND = [
  cylinder("band.across", [0, 0.52, 0.22], 0.016, 0.62, "band", IDENTITY, false),
];

export const spec = buildExerciseSpec({
  id: "banded-push-up",
  catalogId: "1a05c6f170d8802db13bd5aa07cd1eaf",
  name: "Banded Push-Up",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 1.6, bottom: 0.2, raise: 1.3, top: 0.35 },
  stiffness: { elbow: 80, shoulder: 8, hip: 8, knee: 10, ankle: 12 },
  extraGoals: (body) => [
    lockAngle(body, "ankle_L.dorsi", -8, 36),
    lockAngle(body, "ankle_R.dorsi", -8, 36),
    lockAngle(body, "knee_L.flex", 12, 24),
    lockAngle(body, "knee_R.flex", 12, 24),
  ],
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "elbow_L.flex", 8, 400),
      lockAngle(body, "elbow_R.flex", 8, 400),
    ],
    end: [
      lockAngle(body, "elbow_L.flex", 108, 280),
      lockAngle(body, "elbow_R.flex", 108, 280),
    ],
  }),
  station: { kind: "pushup", handX: 0.34, handZ: 0.58, feetElevationY: 0.08, footX: 0.14, footZ: -0.82 },
  extraEquipment: BAND,
  extraContacts: { "pushup.footBox": { foot_L: 0.07, foot_R: 0.07 } },
  apparatus: { kind: "none", bodyweightLoads: LOADS },
  hints: {
    start: {
      ...POSTURE_HINTS.pronePlank,
      ...HANDS,
      "root.y": 0.56,
      "shoulder.elev": 78,
      "shoulder.plane": 72,
      "elbow.flex": 6,
      "clavicle.prot": 6,
      "clavicle.elev": 2,
    },
    end: {
      ...POSTURE_HINTS.pronePlank,
      ...HANDS,
      "root.y": 0.34,
      "root.pitch": 82,
      "shoulder.elev": 40,
      "shoulder.plane": 62,
      "elbow.flex": 108,
      "clavicle.prot": -8,
      "clavicle.elev": -2,
    },
  },
  checks: () => [
    checkJointWithinAt(
      "elbows-locked",
      "Elbows lock out in the tall plank",
      "Finish with your elbows fully straightened as the band across the upper back is stretched.",
      "elbow_L.flex",
      "top",
      0,
      20,
    ),
    checkJointWithinAt(
      "chest-down",
      "Elbows bend until the chest is down",
      "Bend your elbows to lower your chest until it lightly touches the ground. Band tension falls as you descend.",
      "elbow_L.flex",
      "bottom",
      80,
      125,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows travel through the push-up",
      "Press into the ground to lift the whole body until the elbows are straight.",
      "elbow_L.flex",
      65,
    ),
    checkFlatBack(
      "Tighten your abdominal muscles and squeeze your glutes so you can draw a straight line from your knees through your hips to your shoulders.",
    ),
  ],
});
