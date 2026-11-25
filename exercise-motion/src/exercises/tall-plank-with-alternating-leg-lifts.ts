import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import type { Goal } from "../solver";

const PLANK = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.4,
  "root.pitch": 84,
  "lumbar.flex": 10,
  "thoracic.flex": 6,
  "neck.flex": 2,
  "hip.abd": 6,
  "knee.flex": 4,
  "ankle.dorsi": 8,
  "clavicle.prot": 12,
  "shoulder.elev": 78,
  "shoulder.plane": 86,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 78,
  "wrist.flex": 42,
};

const START = { ...PLANK, "hip.flex": 4 };

/** Left leg lifts a few inches. The right foot stays down. Trunk does not twist or arch. */
const PEAK = sidedHints(
  "L",
  { "hip.flex": -16, "knee.flex": 4, "ankle.dorsi": -8 },
  { "hip.flex": 4, "knee.flex": 4, "ankle.dorsi": 8 },
  PLANK,
);

function plantStanceFoot(body: Parameters<typeof anchorPoint>[0]): Goal {
  return ({ frame, push }) => {
    const l = anchorPoint(body, frame, "ballIn_L");
    const r = anchorPoint(body, frame, "ballIn_R");
    const p = l.y <= r.y ? l : r;
    const x = l.y <= r.y ? 0.1 : -0.1;
    push(40 * (p.y - 0.08));
    push(16 * (p.x - x));
    push(14 * (p.z + 0.72));
  };
}

export const spec = buildExerciseSpec({
  id: "tall-plank-with-alternating-leg-lifts",
  catalogId: "1f55c6f170d8803db959ead2390b49ec",
  name: "Tall Plank With Alternating Leg Lifts",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "alternating",
  grip: "open",
  brace: true,
  phaseLabels: ["Plank", "Lift", "Switch", "Lift"],
  tempo: { lower: 1.1, bottom: 0.25, raise: 1.1, top: 0.2 },
  station: {
    kind: "pushup",
    forearmsOnFloor: false,
    plantFeet: false,
    handX: 0.26,
    handZ: 0.5,
    handElevationY: 0.05,
    footZ: -0.72,
    footX: 0.1,
  },
  stiffness: { hip: 5, ankle: 6, lumbar: 16, thoracic: 14, shoulder: 8, elbow: 6 },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "palmFlat_L", bodyweightShare: 0.3, grip: "press", direction: [0, 1, 0] },
      { anchor: "palmFlat_R", bodyweightShare: 0.3, grip: "press", direction: [0, 1, 0] },
    ],
  },
  extraGoals: (body) => [plantStanceFoot(body)],
  hints: { start: START, end: PEAK },
  checks: () => [
    checkFlatBack(
      "Tighten your abdominal muscles and squeeze your glutes to maintain a flat back so you can draw a straight line from your legs through your hips to your torso.",
      10,
    ),
    checkNeutralNeck("Keep your neck in a neutral position, as you would normally do when standing upright."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "You should be in the same position as the top of a push-up, keeping your elbows straight.",
      "elbow_L.flex",
      "peak",
      0,
      24,
    ),
    checkJointRange(
      "leg-lifts",
      "One straight leg lifts slightly",
      "While keeping your knees straightened, lift one foot slightly up off the ground. Do not lift it any higher than you can while keeping the trunk rigid.",
      "hip_L.flex",
      10,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Both knees stay straight",
      "Lift the leg from the hip while keeping the knee straightened.",
      "knee_L.flex",
      "peak",
      0,
      20,
    ),
  ],
});
