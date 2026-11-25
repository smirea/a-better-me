import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { box } from "../equipment";
import { checkFeetPlanted, checkJointWithinAt } from "../postures";
import { keepAbove, pin, plantFoot } from "../solver";

const ARMS = {
  "clavicle.elev": 2,
  "shoulder.elev": 12,
  "shoulder.plane": 4,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 16,
  "wrist.flex": 0,
};

const WORK = { "hip.flex": 92, "hip.abd": 8, "hip.rot": 4, "knee.flex": 96, "ankle.dorsi": 22 };
const FREE = { "hip.flex": 28, "hip.abd": 6, "hip.rot": 0, "knee.flex": 8, "ankle.dorsi": 4 };

const SIT = sidedHints("L", WORK, FREE, {
  ...POSTURE_HINTS.standing,
  "root.y": 0.56,
  "root.x": 0.04,
  "root.z": 0.02,
  "root.pitch": 2,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
  ...ARMS,
});

export const spec = buildExerciseSpec({
  id: "single-leg-wall-sit",
  catalogId: "2055c6f170d8805e89edc426eed603c6",
  name: "Single Leg Wall Sit",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "open",
  isometric: true,
  cameraHint: { view: "Side" },
  phaseLabels: ["Slide", "Sit", "Hold", "Hold"],
  station: { kind: "cardio", machine: "none" },
  apparatus: { kind: "none" },
  extraEquipment: [box("wall.post", [0, 0.72, -0.22], [0.36, 1.45, 0.08], "steel", false)],
  ground: "heel_L",
  extraGoals: (body) => [
    ...plantFoot(body, "L", new Vector3(0.08, 0, 0.32), 0.08),
    pin(body, "upperBack", () => new Vector3(0, 0, -0.16), 22, "z"),
    pin(body, "sacrum", () => new Vector3(0, 0, -0.16), 26, "z"),
    keepAbove(body, "heel_R", 0.08, 40),
    keepAbove(body, "ballIn_R", 0.06, 36),
  ],
  stiffness: { knee: 6, hip: 5, lumbar: 8, ankle: 3 },
  hints: { start: SIT, end: SIT },
  checks: () => [
    checkFeetPlanted("Keep the sole of the working foot fully on the ground.", ["L"]),
    checkJointWithinAt(
      "thigh-parallel",
      "Working thigh holds about parallel",
      "Hold the squat with the working thigh about parallel to the ground.",
      "knee_L.flex",
      "start",
      80,
      115,
    ),
    checkJointWithinAt(
      "free-knee",
      "Free knee stays straight and the foot is off the floor",
      "Shift onto one foot and straighten the other knee so that foot leaves the ground.",
      "knee_R.flex",
      "start",
      0,
      22,
    ),
    checkJointWithinAt(
      "hips-level",
      "Hips stay level",
      "Keep the hip bones level rather than dropping the free-leg side.",
      "hip_L.abd",
      "start",
      -6,
      20,
    ),
    checkJointWithinAt(
      "torso-up",
      "Back and pelvis stay on the wall",
      "Keep the back and pelvis on the wall through the hold.",
      "lumbar.flex",
      "start",
      -8,
      16,
    ),
  ],
});
