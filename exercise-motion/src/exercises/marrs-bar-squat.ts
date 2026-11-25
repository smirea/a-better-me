import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * A Marrs bar is a cambered yoke with a padded center and handles angled down in front of the torso.
 * The rig has no Marrs-bar mesh, so the safety squat bar stands in for the pad and forward handles.
 */
const ARMS = {
  "clavicle.prot": 8,
  "shoulder.elev": 48,
  "shoulder.plane": 50,
  "shoulder.twist": 22,
  "elbow.flex": 98,
  "forearm.pron": -18,
  "wrist.flex": 12,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "hip.abd": 10,
  "hip.rot": 12,
  "knee.flex": 6,
  "ankle.dorsi": 3,
  ...ARMS,
};

const BOTTOM = {
  "root.y": 0.54,
  "root.z": -0.06,
  "root.pitch": 22,
  "hip.flex": 108,
  "hip.abd": 16,
  "hip.rot": 8,
  "knee.flex": 118,
  "ankle.dorsi": 24,
  "lumbar.flex": 4,
  "thoracic.flex": 6,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "marrs-bar-squat",
  catalogId: "2fe5c6f170d8807b94aff54e638e898b",
  name: "Marrs Bar Squat",
  defaultLoadKg: 60,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Bottom", "Stand", "Top"],
  tempo: { lower: 2, bottom: 0.2, raise: 1.4, top: 0.5 },
  station: { kind: "standing", stanceX: 0.18, toeOutDeg: 16, trackKnees: 12, rack: { hookY: 1.32, safetyY: 0.62 } },
  apparatus: {
    kind: "barbell",
    style: "ssb",
    restAnchor: "traps",
    gripX: 0.16,
    skipHandRequired: true,
    anchor: "press",
  },
  extraContacts: {
    bar: { neck: 0.03, girdle: 0.05, chest: 0.03, upperarm_L: 0.05, upperarm_R: 0.05, hand_L: 0.06, hand_R: 0.06 },
  },
  hints: { start: STAND, end: BOTTOM },
  checks: () => [
    checkFlatBack(
      "Let your torso naturally lean forward at your hips to maintain your balance, but avoid letting your lower back round or chest cave down.",
      16,
    ),
    checkNeutralNeck(
      "Throughout your set, keep your neck near a neutral position, like when you are normally looking straight ahead while standing upright.",
    ),
    checkFeetPlanted(
      "Keep the entire sole of each foot firmly planted on the ground as your weight is evenly distributed throughout your feet.",
    ),
    checkJointRange(
      "full-depth",
      "Squat through the available range",
      "Continue to squat down through the full range of motion your mobility allows, often until the thighs are fairly close to parallel.",
      "knee_L.flex",
      75,
    ),
    checkJointWithinAt(
      "handles",
      "Hands stay on the forward handles",
      "Your palms should be facing inward while holding the handles with bent elbows, shoulders snug under the pads.",
      "elbow_L.flex",
      "bottom",
      70,
      130,
    ),
    checkJointWithinAt(
      "lockout",
      "Stand upright",
      "Reverse the movement by driving through the ground while extending your knees and hips to stand upright.",
      "knee_L.flex",
      "top",
      0,
      16,
    ),
  ],
});
