import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const ARMS = {
  "clavicle.prot": -12,
  "clavicle.elev": 6,
  "shoulder.elev": 38,
  "shoulder.plane": -30,
  "shoulder.twist": -64,
  "elbow.flex": 132,
  "forearm.pron": 56,
  "wrist.flex": -18,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "hip.abd": 10,
  "hip.rot": 14,
  "knee.flex": 6,
  "ankle.dorsi": 3,
  ...ARMS,
};

/** Stops a little above a full squat so the bar can settle on the pins. */
const BOTTOM = {
  "root.y": 0.68,
  "root.z": -0.04,
  "root.pitch": 20,
  "hip.flex": 86,
  "hip.abd": 16,
  "hip.rot": 8,
  "knee.flex": 92,
  "ankle.dorsi": 16,
  "ankle.inv": 2,
  "lumbar.flex": 4,
  "thoracic.flex": 5,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "barbell-pin-squat",
  catalogId: "1a25c6f170d8802fadf7d93d3f4130fb",
  name: "Barbell Pin Squat",
  defaultLoadKg: 70,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Pins", "Stand", "Top"],
  tempo: { lower: 1.8, bottom: 2, raise: 1.5, top: 0.5 },
  station: { kind: "standing", stanceX: 0.19, toeOutDeg: 20, trackKnees: 12, rack: { hookY: 1.38, safetyY: 1.2 } },
  apparatus: { kind: "barbell", gripX: 0.4, anchor: "press", restAnchor: "traps" },
  hints: { start: STAND, end: BOTTOM },
  extraContacts: { "rack.safety_L": { hand_L: 0.02 }, "rack.safety_R": { hand_R: 0.02 } },
  checks: () => [
    checkFlatBack("Keep your chest up and back flat as the bar settles onto the pins.", 16),
    checkNeutralNeck("Throughout your set, keep your neck near a neutral position."),
    checkFeetPlanted("Keep the entire sole of each foot firmly planted on the ground."),
    checkJointRange("knee-depth", "Descend onto the pins", "Squat down until the bar contacts the pins, which sit slightly above a full squat.", "knee_L.flex", 55),
    checkJointWithinAt("dead-stop", "Dead stop on the pins", "Let the bar rest on the pins and stay completely still for about two seconds.", "knee_L.flex", "peak", 75, 110),
    checkJointWithinAt("above-parallel", "Pins sit above the deepest squat", "The pins are slightly above the lowest point of a typical back squat.", "hip_L.flex", "peak", 70, 105),
  ],
});
