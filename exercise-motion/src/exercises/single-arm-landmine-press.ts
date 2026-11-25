import { Vector3 } from "three";
import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { rad } from "../math";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";


const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 6,
  "hip.flex": 10,
  "knee.flex": 8,
  "ankle.dorsi": 4,
};

const WORKING_BOTTOM = {
  "clavicle.elev": 4,
  "clavicle.prot": 6,
  "shoulder.elev": 55,
  "shoulder.plane": 80,
  "shoulder.twist": 18,
  "elbow.flex": 108,
  "forearm.pron": 8,
  "wrist.flex": 6,
};

const WORKING_TOP = {
  "clavicle.elev": 16,
  "clavicle.prot": 12,
  "shoulder.elev": 118,
  "shoulder.plane": 40,
  "shoulder.twist": 10,
  "elbow.flex": 8,
  "forearm.pron": 6,
  "wrist.flex": 2,
};

const REST = {
  "clavicle.elev": 0,
  "clavicle.prot": -4,
  "shoulder.elev": 8,
  "shoulder.plane": 10,
  "shoulder.twist": 8,
  "elbow.flex": 10,
  "forearm.pron": 20,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "single-arm-landmine-press",
  catalogId: "1a15c6f170d8808aab66c6855e05e946",
  name: "Single Arm Landmine Press",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Shoulder"],
  tempo: { lower: 1.1, bottom: 0.2, raise: 1.4, top: 0.25 },
  station: {
    kind: "standing",
    stanceX: 0.15,
    heelZ: -0.15,
    toeOutDeg: 8,
    balanceZ: -0.05,
  },
  apparatus: { kind: "landmine", pivotZ: 1.65, sides: ["L"] },
  extraGoals: (body) => [
    ({ angles: a, frame, push }) => {
      const hand = anchorPoint(body, frame, "grip_L");
      const pivot = new Vector3(0, 0.06, 1.65);
      const d = hand.distanceTo(pivot);
      push(22 * (d - 1.95));
      push(12 * (hand.x - 0.08));
      // Side-delt passive range ends at 20° of adduction. Stop short of that, and no further.
      push(64 * Math.min(0, a["shoulder_L.abd"] - rad(-16)));
    },
  ],
  hints: {
    start: sidedHints("L", WORKING_BOTTOM, REST, TRUNK),
    end: sidedHints("L", WORKING_TOP, REST, { ...TRUNK, "root.pitch": 6 }),
  },
  checks: () => [
    checkFlatBack("Throughout your set, avoid leaning your torso back via excessive lower back arching."),
    checkFeetPlanted("Take a small step forward on the side you are not training to adopt a staggered stance for greater stability."),
    checkJointWithinAt(
      "elbow-bent-start",
      "Elbow starts bent at the shoulder",
      "At the bottom, your elbow should be tucked near your side or slightly in front of it.",
      "elbow_L.flex",
      "start",
      80,
      130,
    ),
    checkJointWithinAt(
      "elbow-locked",
      "Elbow finishes straight",
      "Press the bar upward and mildly forward until you have fully straightened your elbow.",
      "elbow_L.flex",
      "peak",
      0,
      28,
    ),
    checkJointWithinAt(
      "arm-up-forward",
      "Arm finishes up and forward",
      "At the top, your arm should be angled upward and forward.",
      "shoulder_L.elev",
      "peak",
      70,
      175,
    ),
    checkJointRange(
      "shoulder-flexion",
      "Shoulder flexes",
      "The primary joint action is shoulder flexion.",
      "shoulder_L.elev",
      35,
    ),
  ],
});
