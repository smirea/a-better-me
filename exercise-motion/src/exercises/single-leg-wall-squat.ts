import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { box } from "../equipment";
import { checkAnchorTravel, checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";
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

const WORK_UP = { "hip.flex": 8, "hip.abd": 6, "hip.rot": 2, "knee.flex": 6, "ankle.dorsi": 4 };
const FREE = { "hip.flex": 48, "hip.abd": 4, "hip.rot": 0, "knee.flex": 8, "ankle.dorsi": 4 };
const WORK_DOWN = { "hip.flex": 92, "hip.abd": 8, "hip.rot": 4, "knee.flex": 96, "ankle.dorsi": 22 };

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.x": 0.04,
  "root.pitch": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "single-leg-wall-squat",
  catalogId: "2055c6f170d8809db02ce4a60945c61e",
  name: "Single Leg Wall Squat",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "open",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Parallel", "Drive", "Stand"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: { kind: "cardio", machine: "none" },
  apparatus: { kind: "none" },
  extraEquipment: [box("wall.post", [0, 0.72, -0.22], [0.36, 1.45, 0.08], "steel", false)],
  ground: "heel_L",
  extraGoals: (body) => [
    ...plantFoot(body, "L", new Vector3(0.08, 0, 0.3), 0.06),
    pin(body, "upperBack", () => new Vector3(0, 0, -0.16), 18, "z"),
    keepAbove(body, "heel_R", 0.1, 42),
    keepAbove(body, "ballIn_R", 0.08, 36),
  ],
  stiffness: { knee: 1.4, hip: 1.2, lumbar: 8, ankle: 2 },
  hints: {
    start: sidedHints("L", WORK_UP, FREE, { ...TRUNK, "root.y": 0.94, "root.z": -0.02 }),
    end: sidedHints("L", WORK_DOWN, FREE, { ...TRUNK, "root.y": 0.56, "root.z": 0.02 }),
  },
  checks: () => [
    checkFeetPlanted("Keep the sole of the working foot fully on the ground.", ["L"]),
    checkJointWithinAt(
      "starts-tall",
      "Starts standing on one leg",
      "Stand upright against the wall on one foot, the other knee straight and that foot off the ground.",
      "knee_L.flex",
      "start",
      0,
      20,
    ),
    checkJointWithinAt(
      "thigh-parallel",
      "Working thigh reaches about parallel",
      "Squat on the working leg until that thigh is about parallel to the ground.",
      "knee_L.flex",
      "peak",
      78,
      115,
    ),
    checkJointWithinAt(
      "free-knee",
      "Free knee stays straight",
      "Keep the free foot off the ground with that knee straightened.",
      "knee_R.flex",
      "peak",
      0,
      24,
    ),
    checkJointRange(
      "knee-rom",
      "Working knee bends and straightens",
      "Squat down the wall on one leg, then press back up to a straight knee.",
      "knee_L.flex",
      60,
    ),
    checkAnchorTravel(
      "depth",
      "Body slides down the wall",
      "Slide the back down the wall until the working thigh is near parallel.",
      "pelvisBottom",
      "y",
      0.16,
    ),
  ],
});
