import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { box } from "../equipment";
import { checkFeetPlanted, checkJointWithinAt, plantBothFeet } from "../postures";
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

/** Thighs parallel, back and pelvis on the wall, arms at the sides. */
const SIT = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.56,
  "root.z": 0.02,
  "root.pitch": 2,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
  "hip.flex": 92,
  "hip.abd": 10,
  "hip.rot": 6,
  "knee.flex": 96,
  "ankle.dorsi": 22,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "bodyweight-wall-sit",
  catalogId: "1a25c6f170d880e988f9f3837d4eb70b",
  name: "Bodyweight Wall Sit",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  isometric: true,
  cameraHint: { view: "Side" },
  phaseLabels: ["Slide", "Sit", "Hold", "Hold"],
  station: { kind: "cardio", machine: "none" },
  apparatus: { kind: "none" },
  extraEquipment: [box("wall.post", [0, 0.72, -0.22], [0.36, 1.45, 0.08], "steel", false)],
  ground: "heel_L",
  extraGoals: (body) => [
    ...plantBothFeet(body, 0.18, 0.32, 0.12, 0),
    pin(body, "upperBack", () => new Vector3(0, 0, -0.16), 22, "z"),
    pin(body, "sacrum", () => new Vector3(0, 0, -0.16), 26, "z"),
  ],
  stiffness: { knee: 6, hip: 5, lumbar: 8, ankle: 3 },
  hints: { start: SIT, end: SIT },
  checks: () => [
    checkFeetPlanted("Keep the soles of the feet fully on the ground, about two foot-lengths from the wall."),
    checkJointWithinAt(
      "thighs-parallel",
      "Thighs hold about parallel",
      "Hold the squat with the thighs about parallel to the ground.",
      "knee_L.flex",
      "start",
      80,
      115,
    ),
    checkJointWithinAt(
      "hips-bent",
      "Hips stay bent in the sit",
      "Slide down until the hips are bent about 90 degrees, back and pelvis still on the wall.",
      "hip_L.flex",
      "start",
      75,
      115,
    ),
    checkJointWithinAt(
      "arms-down",
      "Arms rest at the sides",
      "Keep the arms off the legs, resting at the sides.",
      "elbow_L.flex",
      "start",
      0,
      22,
    ),
    checkJointWithinAt(
      "torso-up",
      "Torso stays against the wall",
      "Keep the back and pelvis on the wall so the torso stays upright.",
      "lumbar.flex",
      "start",
      -8,
      16,
    ),
  ],
});
