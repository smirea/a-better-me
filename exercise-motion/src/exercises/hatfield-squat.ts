import { Vector3 } from "three";
import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { pin } from "../solver";

/**
 * Hatfield squat: safety squat bar on the shoulders, hands on the rack uprights in front
 * for balance. The hands slide down the posts, so only the post's x and z are pinned.
 * Front posts sit at x = ±0.60, z = 0.45 with the default power rack.
 */
const ARMS = {
  "clavicle.elev": 10,
  "clavicle.prot": 14,
  "shoulder.elev": 62,
  "shoulder.plane": 70,
  "shoulder.twist": 8,
  "elbow.flex": 28,
  "forearm.pron": 20,
  "wrist.flex": 6,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "hip.abd": 8,
  "hip.rot": 10,
  "knee.flex": 6,
  "ankle.dorsi": 3,
  ...ARMS,
};

const BOTTOM = {
  "root.y": 0.52,
  "root.z": 0.02,
  "root.pitch": 8,
  "hip.flex": 112,
  "hip.abd": 14,
  "hip.rot": 8,
  "knee.flex": 124,
  "ankle.dorsi": 28,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 2,
  "elbow.flex": 55,
  "shoulder.elev": 48,
  "shoulder.plane": 62,
  "clavicle.elev": 8,
  "clavicle.prot": 10,
  "shoulder.twist": 10,
  "forearm.pron": 16,
  "wrist.flex": 8,
};

const POST_L = new Vector3(0.52, 1.05, 0.4);
const POST_R = new Vector3(-0.52, 1.05, 0.4);

export const spec = buildExerciseSpec({
  id: "hatfield-squat",
  catalogId: "30b5c6f170d88071a717feab59110d45",
  name: "Hatfield Squat",
  defaultLoadKg: 50,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Bottom", "Stand", "Top"],
  tempo: { lower: 2, bottom: 0.2, raise: 1.4, top: 0.5 },
  station: { kind: "standing", stanceX: 0.18, toeOutDeg: 14, trackKnees: 14, rack: { hookY: 1.48, safetyY: 0.55, zCenter: 0 } },
  apparatus: {
    kind: "barbell",
    style: "ssb",
    restAnchor: "traps",
    gripX: 0.16,
    skipHandRequired: true,
    anchor: "press",
  },
  extraContacts: {
    bar: { neck: 0.03, girdle: 0.05, chest: 0.03, upperarm_L: 0.05, upperarm_R: 0.05 },
    "rack.postFront_L": { hand_L: 0.07, forearm_L: 0.05 },
    "rack.postFront_R": { hand_R: 0.07, forearm_R: 0.05 },
  },
  hints: { start: STAND, end: BOTTOM },
  extraGoals: (body) => [
    pin(body, "grip_L", () => POST_L, 22, "x"),
    pin(body, "grip_L", () => POST_L, 22, "z"),
    pin(body, "grip_R", () => POST_R, 22, "x"),
    pin(body, "grip_R", () => POST_R, 22, "z"),
    ({ frame, push }) => {
      const chest = anchorPoint(body, frame, "sternum");
      const left = anchorPoint(body, frame, "grip_L");
      const right = anchorPoint(body, frame, "grip_R");
      push(14 * (left.y - chest.y));
      push(14 * (right.y - chest.y));
    },
  ],
  checks: () => [
    checkFlatBack(
      "Use the uprights for balance so the torso can stay tall. Keep the lower back flat rather than rounding it.",
      14,
    ),
    checkNeutralNeck("Keep the neck near neutral, looking ahead, with the safety squat bar on the upper back."),
    checkFeetPlanted("Keep both feet flat. The hands on the rack posts assist balance; they do not replace the feet."),
    checkJointRange(
      "knee-depth",
      "Squat with the posts for balance",
      "Bend the knees and hips through a deep squat while the safety squat bar stays on the shoulders and the hands hold the uprights in front.",
      "knee_L.flex",
      80,
    ),
    checkJointWithinAt(
      "hands-forward",
      "Hands stay on the uprights in front",
      "Hold the power rack uprights in front of the shoulders for balance and light assistance, with the elbows able to bend as you descend.",
      "shoulder_L.plane",
      "bottom",
      15,
      100,
    ),
    checkJointWithinAt(
      "upright-torso",
      "Torso stays relatively upright",
      "The safety squat bar and the hand support let the torso stay more upright than a free low-bar squat.",
      "thoracic.flex",
      "bottom",
      -8,
      18,
    ),
  ],
});
