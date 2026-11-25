import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { ALONG_Z, box, cylinder } from "../equipment";
import { checkAnchorTravel, checkFeetPlanted, checkJointRange, checkJointWithinAt, plantBothFeet } from "../postures";
import { lockAngle } from "../solver";

const ARMS = {
  "clavicle.elev": 8,
  "clavicle.prot": 4,
  "shoulder.elev": 78,
  "shoulder.plane": 78,
  "shoulder.twist": -8,
  "elbow.flex": 10,
  "forearm.pron": 20,
  "wrist.flex": 0,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.y": 1.02,
  "root.pitch": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
  "hip.abd": 8,
  "hip.rot": 4,
  ...ARMS,
};

const PLATE_Y = 0.08;

export const spec = buildExerciseSpec({
  id: "bodyweight-machine-sissy-squat",
  catalogId: "1a25c6f170d88013b184c7d40c4373bc",
  name: "Bodyweight Machine Sissy Squat",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Parallel", "Drive", "Stand"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.6, top: 0.3 },
  station: { kind: "cardio", machine: "none" },
  apparatus: { kind: "none" },
  ground: "heel_L",
  extraEquipment: [
    box("sissy.plate", [0, PLATE_Y / 2, 0.12], [0.5, PLATE_Y, 0.42], "steel"),
    box("sissy.pad", [0, 0.42, -0.16], [0.34, 0.22, 0.07], "pad"),
    cylinder("sissy.roller", [0, PLATE_Y + 0.1, 0.28], 0.028, 0.36, "pad", ALONG_Z, false),
    box("sissy.post", [0.28, 0.32, -0.16], [0.05, 0.64, 0.05], "steel", false),
  ],
  extraContacts: {
    "sissy.pad": { shank_L: 0.045, shank_R: 0.045 },
    "sissy.plate": { foot_L: 0.04, foot_R: 0.04 },
  },
  stiffness: { lumbar: 8, thoracic: 7, knee: 1.2, hip: 1.1, ankle: 2 },
  hints: {
    start: { ...TRUNK, "hip.flex": 6, "knee.flex": 6, "ankle.dorsi": 4 },
    end: {
      ...TRUNK,
      "root.y": 0.62,
      "root.z": -0.02,
      "root.pitch": 4,
      "hip.flex": 88,
      "knee.flex": 92,
      "ankle.dorsi": 16,
    },
  },
  extraGoals: (body) => [
    ...plantBothFeet(body, 0.14, 0.02, 0.06, PLATE_Y),
    lockAngle(body, "lumbar.flex", 4, 16),
  ],
  checks: () => [
    checkFeetPlanted("Keep the soles of the feet fully on the foot plate.", ["L", "R"], PLATE_Y),
    checkJointWithinAt(
      "upright",
      "Starts standing tall",
      "Stand fully upright on the foot plate with the calves against the pad.",
      "knee_L.flex",
      "start",
      0,
      18,
    ),
    checkJointWithinAt(
      "thighs-parallel",
      "Thighs reach about parallel",
      "Squat until the thighs are about parallel to the ground, knees and hips near 90 degrees.",
      "knee_L.flex",
      "peak",
      75,
      115,
    ),
    checkJointWithinAt(
      "torso-up",
      "Torso stays vertical",
      "Keep the chest up and the shoulders stacked over the hips. Do not lean the torso forward.",
      "hip_L.flex",
      "peak",
      70,
      110,
    ),
    checkJointRange(
      "knee-rom",
      "Knees bend and straighten",
      "Bend the knees and hips to squat down, then press through the foot plate to stand.",
      "knee_L.flex",
      60,
    ),
    checkAnchorTravel(
      "depth",
      "Squat lowers",
      "Squat down in a controlled manner until the thighs are near parallel.",
      "pelvisBottom",
      "y",
      0.18,
    ),
  ],
});
