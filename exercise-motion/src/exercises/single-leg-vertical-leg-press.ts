import { buildExerciseSpec, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Supine on the vertical-press pad: the working leg drives the sled straight up. */
const TRUNK = {
  "root.y": 0.48,
  "root.z": -0.2,
  "root.pitch": -62,
  "lumbar.flex": 0,
  "thoracic.flex": -2,
  "neck.flex": 6,
  "clavicle.elev": 2,
  "shoulder.elev": 14,
  "shoulder.plane": 10,
  "elbow.flex": 62,
  "forearm.pron": 20,
  "wrist.flex": 4,
};

const work = (knee: number, hip: number) => ({
  "hip.flex": hip,
  "hip.abd": 10,
  "hip.rot": 2,
  "knee.flex": knee,
  "ankle.dorsi": 4,
});

const rest = {
  "hip.flex": 36,
  "hip.abd": 30,
  "knee.flex": 55,
  "ankle.dorsi": -6,
};

export const spec = buildExerciseSpec({
  id: "single-leg-vertical-leg-press",
  catalogId: "3895c6f170d880dcbc39fedb90a94a74",
  name: "Single Leg Vertical Leg Press",
  defaultLoadKg: 6,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Deep", "Press", "Lockout"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.4, top: 0.4 },
  station: { kind: "leg-press", angleDeg: 80, singleLeg: "L", stanceX: 0.12 },
  apparatus: { kind: "leg-press-sled", angleDeg: 80, anchor: "ball" },
  stiffness: { knee: 1.1, hip: 1.0, lumbar: 6 },
  hints: {
    start: sidedHints("L", work(16, 70), rest, TRUNK),
    end: sidedHints("L", work(88, 92), rest, TRUNK),
  },
  checks: () => [
    checkFlatBack("Keep the back and hips on the pad while the working leg presses the sled straight up."),
    checkNeutralNeck("Keep the neck near neutral on the pad."),
    checkJointWithinAt(
      "lockout",
      "Working knee straightens overhead",
      "Press the sled upward until the working knee is straight or only slightly bent.",
      "knee_L.flex",
      "top",
      2,
      28,
    ),
    checkJointWithinAt(
      "depth",
      "Working knee bends under the sled",
      "Lower the sled until the working knee is deeply bent, with the other foot still resting off the plate.",
      "knee_L.flex",
      "bottom",
      70,
      135,
    ),
    checkJointRange(
      "knee-rom",
      "Vertical single-leg press",
      "The working leg flexes and extends while the sled travels straight up and down.",
      "knee_L.flex",
      70,
    ),
    checkJointWithinAt(
      "rest-foot",
      "Other foot stays parked",
      "Rest the non-working foot beside the pad so it does not help press the sled.",
      "knee_R.flex",
      "peak",
      40,
      100,
    ),
  ],
});
