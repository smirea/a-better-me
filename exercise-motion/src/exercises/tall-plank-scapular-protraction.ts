import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

const PLANK = {
  ...POSTURE_HINTS.pronePlank,
  "root.z": 0,
  "root.pitch": 74,
  "shoulder.twist": 6,
  "forearm.pron": 75,
  "wrist.flex": -28,
  "hip.flex": 14,
  "hip.abd": 6,
  "knee.flex": 10,
  "ankle.dorsi": -8,
  "neck.flex": 6,
  "lumbar.flex": 4,
  "shoulder.elev": 78,
  "shoulder.plane": 74,
  "elbow.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "tall-plank-scapular-protraction",
  catalogId: "2bf5c6f170d880a0af97cfd8c54d814c",
  name: "Tall Plank Scapular Protraction",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Spread", "Round", "Return", "Together"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.2, top: 0.3 },
  station: { kind: "pushup", handX: 0.32, handZ: 0.52, feetElevationY: 0.06, footX: 0.13, footZ: -0.84 },
  stiffness: { elbow: 40, clavicle: 1.1, shoulder: 6, hip: 8, knee: 8 },
  extraGoals: (body) => [
    lockAngle(body, "elbow_L.flex", 8, 80),
    lockAngle(body, "elbow_R.flex", 8, 80),
  ],
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "palmFlat_L", bodyweightShare: 0.32, grip: "press", direction: [0, 1, 0] },
      { anchor: "palmFlat_R", bodyweightShare: 0.32, grip: "press", direction: [0, 1, 0] },
    ],
  },
  hints: {
    start: { ...PLANK, "root.y": 0.48, "clavicle.prot": -12, "clavicle.elev": 0, "thoracic.flex": -2 },
    end: { ...PLANK, "root.y": 0.56, "clavicle.prot": 20, "clavicle.elev": 2, "thoracic.flex": 6 },
  },
  checks: () => [
    checkFlatBack(
      "Brace the abdominals and glutes so the hips stay up in line with the legs and torso.",
      18,
    ),
    checkNeutralNeck("Keep the neck near neutral, gaze slightly ahead of the hands."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Spread the shoulder blades apart as far as you can while keeping the elbows straight.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "protracted",
      "Shoulder blades finish spread",
      "Push the ground away until the upper back rounds mildly and the chest lifts.",
      "clavicle_L.prot",
      "peak",
      12,
      26,
    ),
    checkJointWithinAt(
      "retracted",
      "Shoulder blades start together",
      "Let the blades move back together so the chest drops closer to the ground than the shoulders.",
      "clavicle_L.prot",
      "start",
      -26,
      0,
    ),
    checkJointRange(
      "scapular-protraction",
      "Scapulae protract and retract",
      "Alternate pushing the floor away and letting the shoulder blades slide back together.",
      "clavicle_L.prot",
      18,
    ),
  ],
});
