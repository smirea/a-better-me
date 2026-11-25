import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { platformBox } from "../equipment";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Palms under the free end, elbows tucked slightly forward of the ribs. */
const GOBLET = {
  "clavicle.elev": 8,
  "clavicle.prot": 6,
  "shoulder.elev": 58,
  "shoulder.plane": 62,
  "shoulder.twist": 18,
  "elbow.flex": 108,
  "forearm.pron": -20,
  "wrist.flex": 18,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 8,
  "hip.abd": 8,
  "hip.rot": 10,
  "knee.flex": 8,
  "ankle.dorsi": 4,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  ...GOBLET,
};

const BOTTOM = {
  "root.y": 0.58,
  "root.z": 0.02,
  "root.pitch": 16,
  "hip.flex": 100,
  "hip.abd": 14,
  "hip.rot": 8,
  "knee.flex": 108,
  "ankle.dorsi": 22,
  "lumbar.flex": 4,
  "thoracic.flex": 4,
  "neck.flex": 4,
  ...GOBLET,
};

const PIVOT_Z = 2.15;

export const spec = buildExerciseSpec({
  id: "bottoms-up-landmine-goblet-squat",
  catalogId: "2595c6f170d8809286d2f7e07221340b",
  name: "Bottoms-Up Landmine Goblet Squat",
  defaultLoadKg: 10,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Tap", "Stand", "Top"],
  tempo: { lower: 2, bottom: 0.25, raise: 1.5, top: 0.5 },
  station: { kind: "standing", stanceX: 0.18, toeOutDeg: 14, trackKnees: 10, heelZ: -0.05 },
  apparatus: { kind: "landmine", pivotZ: PIVOT_Z, sides: ["L", "R"] },
  extraEquipment: platformBox("landmine.rest", [0, 0, 0.62], 0.5, 0.42, 0.36, "wood"),
  extraContacts: {
    "landmine.rest": { thigh_L: 0.04, thigh_R: 0.04, shank_L: 0.03, shank_R: 0.03, hand_L: 0.04, hand_R: 0.04 },
    bar: { chest: 0.08, girdle: 0.05, neck: 0.04, head: 0.04 },
  },
  hints: { start: STAND, end: BOTTOM },
  stiffness: { shoulder: 2.4, elbow: 2 },
  extraGoals: (body) => [
    ({ frame, push }) => {
      const left = anchorPoint(body, frame, "grip_L");
      const right = anchorPoint(body, frame, "grip_R");
      const pivot = anchorPoint(body, frame, "heel_L").clone().set(0, 0.08, PIVOT_Z);
      push(20 * (left.x - 0.02));
      push(20 * (right.x + 0.02));
      push(8 * (left.distanceTo(pivot) - 2.12));
      push(8 * (right.distanceTo(pivot) - 2.12));
    },
  ],
  checks: () => [
    checkFlatBack(
      "Keep your back flat, rather than meaningfully rounding it, and avoid letting your chest cave down.",
      16,
    ),
    checkNeutralNeck(
      "In the starting position, your neck should be near a neutral position, like when you are normally standing upright, and you will keep your neck in this position throughout your set.",
    ),
    checkFeetPlanted(
      "Keep the entire sole of each foot firmly planted on the ground as your weight is evenly distributed throughout your feet.",
    ),
    checkJointRange(
      "squat-depth",
      "Squat until the plates can tap the rest",
      "Progressively bend at your knees and hips to squat down in a controlled manner until you can lightly tap the elevated object with the weight plates.",
      "knee_L.flex",
      70,
    ),
    checkJointWithinAt(
      "goblet-elbows",
      "Elbows stay tucked in the goblet hold",
      "Your elbows should be tucked slightly in front of your sides, pointing slightly forward rather than straight down.",
      "elbow_L.flex",
      "bottom",
      80,
      135,
    ),
    checkJointWithinAt(
      "upright-lockout",
      "Stand with hips and knees straight",
      "Drive through the ground to stand up, pushing through your legs until you have straightened your knees and hips.",
      "knee_L.flex",
      "top",
      0,
      18,
    ),
  ],
});
