import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { type Goal } from "../solver";

const PLANK = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.4,
  "root.pitch": 84,
  "lumbar.flex": 10,
  "thoracic.flex": 6,
  "neck.flex": 2,
  "hip.abd": 8,
  "ankle.dorsi": 8,
  "clavicle.prot": 12,
  "shoulder.elev": 78,
  "shoulder.plane": 86,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 76,
  "wrist.flex": 40,
};

const START = { ...PLANK, "hip.flex": 6, "knee.flex": 6 };

/** One knee marches toward the chest. The other leg stays long in the plank. */
const PEAK = sidedHints(
  "L",
  { "hip.flex": 62, "knee.flex": 78, "ankle.dorsi": 10 },
  { "hip.flex": 6, "knee.flex": 6, "ankle.dorsi": 10 },
  PLANK,
);

/** Pulls the lower forefoot onto the floor so the stance leg stays planted while the other marches. */
function plantStanceFoot(body: Parameters<typeof anchorPoint>[0]): Goal {
  return ({ frame, push }) => {
    const l = anchorPoint(body, frame, "ballIn_L");
    const r = anchorPoint(body, frame, "ballIn_R");
    const p = l.y <= r.y ? l : r;
    const x = l.y <= r.y ? 0.11 : -0.11;
    push(36 * (p.y - 0.08));
    push(18 * (p.x - x));
    push(16 * (p.z + 0.72));
  };
}

export const spec = buildExerciseSpec({
  id: "marching-mountain-climber",
  catalogId: "1a45c6f170d880579273fc8857ae335e",
  name: "Marching Mountain Climber",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "alternating",
  grip: "open",
  brace: true,
  phaseLabels: ["Plank", "March", "Switch", "March"],
  tempo: { lower: 1.2, bottom: 0.15, raise: 1.2, top: 0.15 },
  stiffness: { hip: 3, knee: 2.5, ankle: 8, lumbar: 14, thoracic: 12, shoulder: 8, elbow: 6 },
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
      "Tighten your abdominal muscles and squeeze your glutes to flatten your lower back so you can draw a straight line from your knees through your hips to your shoulders.",
      12,
    ),
    checkNeutralNeck("Keep your neck near a neutral position as you would normally do when standing upright."),
    checkJointWithinAt(
      "arms-stay-straight",
      "Arms stay straight under the shoulders",
      "Your upper arms should be directed straight down under your shoulders. Push the ground away so your shoulder blades stay spread.",
      "elbow_L.flex",
      "peak",
      -8,
      36,
    ),
    checkJointRange(
      "knee-march",
      "One knee marches toward the chest",
      "March one knee forward and up toward your chest while keeping the opposite leg on the ground and the trunk still.",
      "knee_L.flex",
      40,
    ),
    checkJointRange(
      "hip-march",
      "The marching hip flexes",
      "Continue keeping your lower back flat while the only movement occurs from your marching leg.",
      "hip_L.flex",
      30,
    ),
  ],
});
