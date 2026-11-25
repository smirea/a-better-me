import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const ARMS = {
  "clavicle.elev": 10,
  "clavicle.prot": 8,
  "shoulder.elev": 82,
  "shoulder.plane": 78,
  "shoulder.twist": -24,
  "elbow.flex": 10,
  "forearm.pron": 30,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "bodyweight-squat",
  catalogId: "1a25c6f170d880728a49e54a8d583742",
  name: "Bodyweight Squat",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  station: { kind: "standing", stanceX: 0.18, toeOutDeg: 18, trackKnees: 12, balanceZ: 0.02 },
  apparatus: { kind: "none" },
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      "root.pitch": 2,
      "hip.abd": 8,
      "hip.rot": 10,
      "knee.flex": 6,
      "ankle.dorsi": 2,
      "lumbar.flex": 0,
      "thoracic.flex": 0,
      "neck.flex": 2,
      ...ARMS,
    },
    end: {
      ...POSTURE_HINTS.standing,
      "root.y": 0.58,
      "root.z": -0.04,
      "root.pitch": 26,
      "hip.flex": 100,
      "hip.abd": 16,
      "hip.rot": 8,
      "knee.flex": 108,
      "ankle.dorsi": 22,
      "lumbar.flex": 6,
      "thoracic.flex": 4,
      "neck.flex": 6,
      ...ARMS,
    },
  },
  checks: () => [
    checkFlatBack(
      "Let your torso naturally lean forward at your hips to maintain your balance, but keep your back flat and chest up.",
      16,
    ),
    checkFeetPlanted(
      "Keep the entire sole of each foot firmly planted on the ground as your weight is evenly distributed throughout your feet.",
    ),
    checkJointRange(
      "knee-depth",
      "Squat down through the available range",
      "Progressively bend at your knees and hips to squat down in a controlled manner.",
      "knee_L.flex",
      70,
    ),
    checkJointWithinAt(
      "thigh-depth",
      "Thighs near parallel at the bottom",
      "People can often descend at least until their thighs are fairly close to being parallel to the ground.",
      "hip_L.flex",
      "bottom",
      75,
      125,
    ),
    checkAnchorTravel(
      "depth",
      "Squat lowers",
      "Continue to squat down through the available range of motion that your mobility enables.",
      "pelvisBottom",
      "y",
      0.2,
    ),
  ],
});
