import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";
import { Vector3 } from "three";

const ARMS = {
  "shoulder.elev": 10,
  "shoulder.plane": 12,
  "elbow.flex": 8,
  "forearm.pron": 10,
  "wrist.flex": 0,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.y": 1.06,
  "root.pitch": 6,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 4,
  ...ARMS,
};

const WORK_UP = { "hip.flex": 8, "hip.abd": 6, "knee.flex": 8, "ankle.dorsi": 4 };
const FREE_UP = { "hip.flex": 6, "hip.abd": 16, "knee.flex": 4, "ankle.dorsi": 22 };
const WORK_DOWN = { "hip.flex": 62, "hip.abd": 10, "knee.flex": 78, "ankle.dorsi": 18 };
const FREE_DOWN = { "hip.flex": 8, "hip.abd": 22, "knee.flex": 4, "ankle.dorsi": 24 };

export const spec = buildExerciseSpec({
  id: "bodyweight-lateral-step-down",
  catalogId: "1a25c6f170d880c78e62db78503cba99",
  name: "Bodyweight Lateral Step-Down",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "open",
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  station: {
    kind: "standing",
    singleFoot: "L",
    stanceX: 0.06,
    heelZ: 0.02,
    trackKnees: 12,
    balanceZ: 0.1,
    box: { height: 0.12, width: 0.34, depth: 0.4, z: 0.06 },
  },
  apparatus: { kind: "none" },
  hints: {
    start: sidedHints("L", WORK_UP, FREE_UP, TRUNK),
    end: sidedHints("L", WORK_DOWN, FREE_DOWN, {
      ...TRUNK,
      "root.y": 0.86,
      "root.x": 0.02,
      "root.pitch": 16,
    }),
  },
  progress: (body, frame) => anchorPoint(body, frame, "pelvisBottom").y,
  extraGoals: (body) => [pin(body, "pelvisBottom", () => new Vector3(0.08, 0, 0), 55, "x")],
  checks: () => [
    checkFlatBack(
      "Let your torso naturally lean forward at your hip to maintain your balance, but keep your back flat and chest up.",
      16,
    ),
    checkFeetPlanted("Keep your elevated heel firmly planted on the step, along with the rest of your sole.", ["L"], 0.12),
    checkJointWithinAt(
      "free-knee",
      "Free knee stays straight",
      "Throughout your set, maintain this foot position and the knee of your non-working side straight.",
      "knee_R.flex",
      "bottom",
      0,
      20,
    ),
    checkJointRange(
      "working-knee",
      "Working knee bends to a heel tap",
      "Progressively bend your working leg’s knee and hip until you can gently tap the ground with the heel of your other foot.",
      "knee_L.flex",
      40,
    ),
    checkAnchorTravel(
      "depth",
      "Step-down lowers",
      "Sit your buttocks back to initiate the descent, then progressively bend your working leg’s knee and hip.",
      "pelvisBottom",
      "y",
      0.1,
    ),
  ],
});
