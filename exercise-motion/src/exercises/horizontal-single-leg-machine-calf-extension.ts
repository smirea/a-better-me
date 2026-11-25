import { buildExerciseSpec, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
const TRUNK = {
  "root.y": 0.5,
  "root.z": -0.2,
  "root.pitch": -50,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
  "clavicle.elev": 2,
  "shoulder.elev": 16,
  "shoulder.plane": 6,
  "shoulder.twist": 8,
  "elbow.flex": 26,
  "forearm.pron": 32,
  "wrist.flex": 6,
};

const active = (ankle: number, knee: number) => ({
  "hip.flex": knee > 12 ? 54 : 46,
  "hip.abd": 8,
  "knee.flex": knee,
  "ankle.dorsi": ankle,
});

const rest = {
  "hip.flex": 64,
  "hip.abd": 16,
  "knee.flex": 90,
  "ankle.dorsi": 4,
};

export const spec = buildExerciseSpec({
  id: "horizontal-single-leg-machine-calf-extension",
  catalogId: "39a5c6f170d880639b9ac2f6254440d7",
  name: "Horizontal Single Leg Machine Calf Extension",
  defaultLoadKg: 4,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Press", "Point", "Lower", "Stretch"],
  tempo: { lower: 2.0, bottom: 0.3, raise: 1.4, top: 0.35 },
  station: { kind: "leg-press", angleDeg: 45, singleLeg: "L", stanceX: 0.1 },
  apparatus: { kind: "leg-press-sled", angleDeg: 45, anchor: "ball" },
  hints: {
    start: sidedHints("L", active(20, 16), rest, TRUNK),
    end: sidedHints("L", active(-30, 8), rest, TRUNK),
  },
  stiffness: { knee: 4, hip: 2.4, ankle: 2.2 },
  checks: () => [
    checkFlatBack("Keep the back near neutral on the backrest."),
    checkNeutralNeck("Hold the neck where it sits when you stand upright."),
    checkJointWithinAt(
      "knee-straight",
      "Working knee stays straight",
      "Straighten the working knee and keep it there. The other foot stays off the platform.",
      "knee_L.flex",
      "start",
      6,
      26,
    ),
    checkJointWithinAt(
      "knee-stays",
      "Working knee stays nearly straight",
      "Press and lower at the ankle, with the knee only slightly bent.",
      "knee_L.flex",
      "peak",
      2,
      18,
    ),
    checkJointRange(
      "ankle-rom",
      "Working ankle points through a full range",
      "Point the working foot away, then let the ball of the foot arc back toward the shin.",
      "ankle_L.dorsi",
      40,
    ),
  ],
});
