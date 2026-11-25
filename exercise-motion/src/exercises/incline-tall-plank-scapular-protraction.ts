import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

const PLANK = {
  ...POSTURE_HINTS.pronePlank,
  "root.z": 0.04,
  "root.pitch": 62,
  "shoulder.twist": 6,
  "forearm.pron": 75,
  "wrist.flex": -24,
  "hip.flex": 12,
  "hip.abd": 6,
  "knee.flex": 8,
  "ankle.dorsi": -18,
  "neck.flex": 8,
  "lumbar.flex": 2,
  "shoulder.elev": 72,
  "shoulder.plane": 70,
  "elbow.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "incline-tall-plank-scapular-protraction",
  catalogId: "2bf5c6f170d8800bb84fd93d0ff6574b",
  name: "Incline Tall Plank Scapular Protraction",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Spread", "Round", "Return", "Together"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.2, top: 0.3 },
  station: { kind: "pushup", handX: 0.32, handZ: 0.42, handElevationY: 0.44, feetElevationY: 0.06, footX: 0.13, footZ: -0.95 },
  extraContacts: { "pushup.footBox": { foot_L: 0.06, foot_R: 0.06 } },
  stiffness: { elbow: 40, clavicle: 1.1, shoulder: 6, hip: 8, knee: 8 },
  extraGoals: (body) => [
    lockAngle(body, "elbow_L.flex", 8, 80),
    lockAngle(body, "elbow_R.flex", 8, 80),
  ],
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "palmFlat_L", bodyweightShare: 0.14, grip: "press", direction: [0, 1, 0] },
      { anchor: "palmFlat_R", bodyweightShare: 0.14, grip: "press", direction: [0, 1, 0] },
    ],
  },
  hints: {
    start: { ...PLANK, "root.y": 0.72, "clavicle.prot": -10, "clavicle.elev": 0, "thoracic.flex": 0 },
    end: { ...PLANK, "root.y": 0.78, "clavicle.prot": 16, "clavicle.elev": 2, "thoracic.flex": 4 },
  },
  checks: () => [
    checkFlatBack(
      "Brace the abdominals and glutes so a straight line runs from the legs through the hips to the torso.",
      14,
    ),
    checkNeutralNeck("Keep the neck neutral so the gaze points diagonally down and forward."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight on the bench",
      "Spread the shoulder blades apart while the elbows stay straight.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointRange(
      "scapular-protraction",
      "Scapulae protract on the incline",
      "Push the bench away, then let the shoulder blades slide back together.",
      "clavicle_L.prot",
      18,
    ),
    {
      id: "hands-elevated",
      label: "Hands rest on a bench-height surface",
      cue: "Place the palms on a stable elevated surface with the elbows straight.",
      evaluate: ({ body, frames }) => {
        const y = anchorPoint(body, frames[0], "palmFlat_L").y;
        return { pass: y >= 0.36 && y <= 0.55, measured: `hands are ${(y * 100).toFixed(0)} cm up` };
      },
    },
  ],
});
