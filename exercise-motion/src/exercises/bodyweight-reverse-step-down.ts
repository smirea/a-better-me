import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { keepAbove, pin } from "../solver";
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
  "root.pitch": 8,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 4,
  ...ARMS,
};

const WORK_UP = { "hip.flex": 8, "hip.abd": 4, "knee.flex": 6, "ankle.dorsi": 4 };
const FREE_UP = { "hip.flex": 4, "hip.abd": 8, "knee.flex": 4, "ankle.dorsi": 28 };
const WORK_DOWN = { "hip.flex": 70, "hip.abd": 8, "knee.flex": 86, "ankle.dorsi": 18 };
const FREE_DOWN = { "hip.flex": 8, "hip.abd": 10, "knee.flex": 6, "ankle.dorsi": 30 };

export const spec = buildExerciseSpec({
  id: "bodyweight-reverse-step-down",
  catalogId: "1a25c6f170d880068d42d3d918cc0a1c",
  name: "Bodyweight Reverse Step-Down",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "open",
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  station: {
    kind: "standing",
    singleFoot: "L",
    stanceX: 0.08,
    heelZ: 0.12,
    trackKnees: 12,
    balanceZ: 0.16,
    box: { height: 0.14, width: 0.42, depth: 0.34, z: 0.22 },
  },
  apparatus: { kind: "none" },
  hints: {
    start: sidedHints("L", WORK_UP, FREE_UP, TRUNK),
    end: sidedHints("L", WORK_DOWN, FREE_DOWN, {
      ...TRUNK,
      "root.y": 0.82,
      "root.z": 0.04,
      "root.pitch": 18,
    }),
  },
  progress: (body, frame) => anchorPoint(body, frame, "pelvisBottom").y,
  extraGoals: (body) => [
    pin(body, "pelvisBottom", () => new Vector3(0.08, 0, 0), 50, "x"),
    keepAbove(body, "heel_R", 0, 45),
    keepAbove(body, "toe_R", 0.02, 30),
  ],
  checks: () => [
    checkFlatBack(
      "Let your torso naturally lean forward at your hip to maintain your balance, but keep your back flat and chest up.",
      16,
    ),
    checkFeetPlanted("Keep your elevated heel firmly planted on the step, along with the rest of your sole.", ["L"], 0.14),
    checkJointWithinAt(
      "free-knee",
      "Free knee stays straight",
      "Throughout your set, maintain this foot position and the knee of your non-working side straight.",
      "knee_R.flex",
      "bottom",
      0,
      22,
    ),
    checkJointRange(
      "working-knee",
      "Working knee bends until the heel taps",
      "Progressively bend your working leg’s knee and hip until you can gently tap the ground with the heel of your other foot.",
      "knee_L.flex",
      45,
    ),
    checkAnchorTravel(
      "depth",
      "Reverse step-down lowers",
      "Sit your buttocks back to initiate the descent, then progressively bend your working leg’s knee and hip.",
      "pelvisBottom",
      "y",
      0.12,
    ),
  ],
});
