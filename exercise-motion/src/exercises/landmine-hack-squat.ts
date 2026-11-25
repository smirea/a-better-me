import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * Landmine hack squat: the free end stays at the upper chest and shoulders while the
 * knees travel forward and the torso stays tall, leaning back into the sleeve.
 * The rig's landmine is a straight 2.2 m bar from the floor pivot through the hands, so
 * facing fully away with the sleeve on the upper back sends that shaft through the torso.
 * The pivot stays in front and the lifter leans back into the end, which is the hack lean
 * this solver can hold without the bar passing through the body.
 */
const ARMS = {
  "clavicle.elev": 10,
  "clavicle.prot": 4,
  "shoulder.elev": 62,
  "shoulder.plane": 58,
  "shoulder.twist": 12,
  "elbow.flex": 100,
  "forearm.pron": -12,
  "wrist.flex": 14,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": -4,
  "hip.abd": 6,
  "hip.rot": 6,
  "knee.flex": 8,
  "ankle.dorsi": 6,
  "lumbar.flex": -2,
  ...ARMS,
};

const BOTTOM = {
  "root.y": 0.56,
  "root.pitch": 4,
  "hip.flex": 88,
  "hip.abd": 10,
  "hip.rot": 4,
  "knee.flex": 112,
  "ankle.dorsi": 28,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 2,
  ...ARMS,
};

const PIVOT_Z = 2.15;

export const spec = buildExerciseSpec({
  id: "landmine-hack-squat",
  catalogId: "3b15c6f170d88049bc4ae47a518c3134",
  name: "Landmine Hack Squat",
  defaultLoadKg: 10,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Bottom", "Stand", "Top"],
  tempo: { lower: 2, bottom: 0.2, raise: 1.4, top: 0.45 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 8, trackKnees: 16, heelZ: -0.02 },
  apparatus: { kind: "landmine", pivotZ: PIVOT_Z, sides: ["L", "R"] },
  extraContacts: { bar: { chest: 0.08, neck: 0.04, girdle: 0.04, head: 0.04 } },
  hints: { start: STAND, end: BOTTOM },
  stiffness: { shoulder: 2.2, elbow: 1.8 },
  extraGoals: (body) => [
    ({ frame, push }) => {
      const left = anchorPoint(body, frame, "grip_L");
      const right = anchorPoint(body, frame, "grip_R");
      const pivot = left.clone().set(0, 0.08, PIVOT_Z);
      push(18 * (left.x - 0.02));
      push(18 * (right.x + 0.02));
      push(8 * (left.distanceTo(pivot) - 2.12));
      push(8 * (right.distanceTo(pivot) - 2.12));
    },
  ],
  checks: () => [
    checkFlatBack(
      "Lean back into the sleeve at the upper chest, and keep the lower back flat rather than rounding as the knees travel forward.",
      14,
    ),
    checkNeutralNeck("Keep the neck near neutral while the bar end rests at the shoulders and upper chest."),
    checkFeetPlanted("Keep both feet flat. The knees travel forward over the toes in the hack pattern."),
    checkJointRange(
      "knee-dominant",
      "Knees bend through the hack squat",
      "Squat by bending the knees while the torso stays tall and you lean back into the landmine sleeve.",
      "knee_L.flex",
      70,
    ),
    checkJointWithinAt(
      "forward-knees",
      "Shins incline as the knees travel forward",
      "A landmine hack squat loads the quads by letting the knees travel forward while the bar supports the torso.",
      "ankle_L.dorsi",
      "bottom",
      14,
      42,
    ),
    checkJointWithinAt(
      "tall-torso",
      "Torso stays tall",
      "Do not fold forward. Stay upright and lean slightly back into the end of the bar.",
      "thoracic.flex",
      "bottom",
      -8,
      14,
    ),
  ],
});
