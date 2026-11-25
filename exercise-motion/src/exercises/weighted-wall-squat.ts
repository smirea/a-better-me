import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { box } from "../equipment";
import { checkAnchorTravel, checkFeetPlanted, checkJointRange, checkJointWithinAt, plantBothFeet } from "../postures";
import { pin } from "../solver";

const ARMS = {
  "clavicle.elev": 2,
  "shoulder.elev": 12,
  "shoulder.plane": 4,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 16,
  "wrist.flex": 0,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.943,
  "root.z": -0.02,
  "root.pitch": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
  "hip.flex": 8,
  "hip.abd": 8,
  "hip.rot": 4,
  "knee.flex": 6,
  "ankle.dorsi": 4,
  ...ARMS,
};

const SIT = {
  ...STAND,
  "root.y": 0.56,
  "root.z": 0.02,
  "hip.flex": 92,
  "knee.flex": 96,
  "ankle.dorsi": 22,
};

export const spec = buildExerciseSpec({
  id: "weighted-wall-squat",
  catalogId: "2055c6f170d8805a9d5eecd8e9c9d85a",
  name: "Weighted Wall Squat",
  defaultLoadKg: 12,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Parallel", "Drive", "Stand"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: { kind: "cardio", machine: "none" },
  apparatus: { kind: "dumbbells" },
  extraEquipment: [box("wall.post", [0, 0.72, -0.22], [0.36, 1.45, 0.08], "steel", false)],
  ground: "heel_L",
  extraGoals: (body) => [
    ...plantBothFeet(body, 0.2, 0.28, 0.1, 0),
    pin(body, "upperBack", () => new Vector3(0, 0, -0.16), 18, "z"),
  ],
  stiffness: { knee: 1.4, hip: 1.2, lumbar: 8, ankle: 2 },
  hints: { start: STAND, end: SIT },
  checks: () => [
    checkFeetPlanted("Keep the soles of the feet fully on the ground while the back stays on the wall."),
    checkJointWithinAt(
      "starts-tall",
      "Starts standing against the wall",
      "Stand upright with the back and pelvis on the wall and the knees straight.",
      "knee_L.flex",
      "start",
      0,
      18,
    ),
    checkJointWithinAt(
      "thighs-parallel",
      "Thighs reach about parallel",
      "Slide down the wall until the thighs are about parallel to the ground.",
      "knee_L.flex",
      "peak",
      78,
      115,
    ),
    checkJointWithinAt(
      "hips-bent",
      "Hips bend with the knees",
      "Bend at the knees and hips while the pelvis stays on the wall.",
      "hip_L.flex",
      "peak",
      70,
      115,
    ),
    checkJointRange(
      "knee-rom",
      "Knees bend and straighten on the wall",
      "Squat down the wall, then press back up to straight knees.",
      "knee_L.flex",
      65,
    ),
    checkAnchorTravel(
      "depth",
      "Body slides down the wall",
      "Slide the back down the wall until the thighs are near parallel.",
      "pelvisBottom",
      "y",
      0.18,
    ),
  ],
});
