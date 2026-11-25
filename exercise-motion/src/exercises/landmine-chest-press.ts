import { Vector3 } from "three";
import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { rad } from "../math";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";


const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 8,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 10,
  "hip.flex": 8,
  "knee.flex": 6,
  "ankle.dorsi": 3,
};

const ARMS_BOTTOM = {
  "clavicle.elev": 4,
  "clavicle.prot": 2,
  "shoulder.elev": 32,
  "shoulder.plane": 78,
  "shoulder.twist": 16,
  "elbow.flex": 100,
  "forearm.pron": 12,
  "wrist.flex": 8,
};

const ARMS_TOP = {
  "clavicle.elev": 14,
  "clavicle.prot": 8,
  "shoulder.elev": 80,
  "shoulder.plane": 55,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 8,
  "wrist.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "landmine-chest-press",
  catalogId: "1a15c6f170d880f38e71dba3b3203cbb",
  name: "Landmine Chest Press",
  defaultLoadKg: 12,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Chest"],
  tempo: { lower: 1.1, bottom: 0.2, raise: 1.45, top: 0.25 },
  station: { kind: "standing", stanceX: 0.16, heelZ: -0.15, toeOutDeg: 10, balanceZ: -0.05 },
  apparatus: { kind: "landmine", pivotZ: 1.65, sides: ["L", "R"] },
  hints: {
    start: { ...TRUNK, ...ARMS_BOTTOM },
    end: { ...TRUNK, ...ARMS_TOP, "root.pitch": 6, "neck.flex": 6 },
  },
  extraGoals: (body) => [
    ({ angles: a, frame, push }) => {
      const left = anchorPoint(body, frame, "grip_L");
      const right = anchorPoint(body, frame, "grip_R");
      const pivot = new Vector3(0, 0.06, 1.65);
      push(24 * (left.distanceTo(pivot) - 1.9));
      push(24 * (right.distanceTo(pivot) - 1.98));
      push(28 * left.x);
      push(28 * right.x);
      push(6 * (a["shoulder_L.abd"] - rad(-8)));
      push(6 * (a["shoulder_R.abd"] - rad(-8)));
    },
  ],
  checks: () => [
    checkFlatBack("Throughout your set, avoid leaning your torso back via excessive lower back arching."),
    checkFeetPlanted("Continue keeping your knees and hips straightened rather than using them to help you lift the weight."),
    checkJointWithinAt(
      "elbows-at-chest",
      "Bar starts at the chest",
      "Lower the bar in a controlled manner until its end is directly in front of your upper chest.",
      "elbow_L.flex",
      "start",
      75,
      125,
    ),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows finish straight",
      "You should finish with your elbows fully straightened as your arms are angled upward and forward.",
      "elbow_L.flex",
      "peak",
      0,
      42,
    ),
    checkJointWithinAt(
      "arms-up-forward",
      "Arms finish up and forward",
      "Press the bar upward and outward by driving your elbows upward as you progressively straighten them.",
      "shoulder_L.elev",
      "peak",
      55,
      160,
    ),
    checkJointRange(
      "shoulder-flexion",
      "Shoulders flex",
      "The primary joint action is shoulder flexion.",
      "shoulder_L.elev",
      22,
    ),
  ],
});
