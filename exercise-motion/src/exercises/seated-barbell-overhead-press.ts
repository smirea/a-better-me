import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": -6,
  "lumbar.flex": -6,
  "thoracic.flex": -4,
  "neck.flex": 8,
  "hip.flex": 86,
  "knee.flex": 88,
};

const ARMS_BOTTOM = {
  "clavicle.elev": 8,
  "clavicle.prot": -8,
  "shoulder.elev": 78,
  "shoulder.plane": 40,
  "shoulder.twist": 10,
  "elbow.flex": 96,
  "forearm.pron": 70,
  "wrist.flex": 6,
};

const ARMS_TOP = {
  "clavicle.elev": 16,
  "clavicle.prot": 2,
  "shoulder.elev": 166,
  "shoulder.plane": 16,
  "shoulder.twist": 6,
  "elbow.flex": 8,
  "forearm.pron": 66,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "seated-barbell-overhead-press",
  catalogId: "1a05c6f170d8803c86effb7acb6ade56",
  name: "Seated Barbell Overhead Press",
  defaultLoadKg: 36,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Chest"],
  tempo: { lower: 1.15, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.43,
    stanceX: 0.18,
    heelZ: 0.36,
    pinHead: false,
    frame: { type: "adjustable-bench", backAngleDeg: 82 },
  },
  apparatus: {
    kind: "barbell",
    gripX: 0.32,
    anchor: "press",
    path: { startY: 1.18, startZ: 0.22, endY: 1.82, endZ: 0.08, arcBulgeZ: 0.05 },
  },
  hints: {
    start: { ...SEAT, ...ARMS_BOTTOM, "neck.flex": 12 },
    end: { ...SEAT, ...ARMS_TOP, "neck.flex": -2 },
  },
  extraContacts: { bar: { head: 0.05, chest: 0.04 } },
  checks: () => [
    checkFlatBack(
      "Keep your hip bones snugly against the bench as you avoid scooting your hips forward or excessively arching your lower back.",
    ),
    checkFeetPlanted(
      "From this starting position and throughout the exercise, your feet should be firmly planted on the ground, while your buttocks and upper back are snugly contacting the bench.",
    ),
    checkJointWithinAt(
      "bar-at-chest",
      "Bar meets the upper chest",
      "Lower the bar in a controlled manner until you are able to tap near your upper chest lightly with the bar.",
      "elbow_L.flex",
      "start",
      75,
      120,
    ),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked overhead",
      "Press the bar up overhead until your elbows are fully straightened.",
      "elbow_L.flex",
      "peak",
      0,
      18,
    ),
    checkJointWithinAt(
      "overhead-lockout",
      "Arms finish overhead",
      "It may help to focus on driving your elbows upward and inward.",
      "shoulder_L.elev",
      "peak",
      150,
      175,
    ),
    checkAnchorTravel(
      "bar-rises",
      "Bar travels upward",
      "Reverse the movement by pressing the bar up overhead until your elbows are fully straightened.",
      "press_L",
      "y",
      0.35,
    ),
    checkJointRange(
      "shoulder-rom",
      "Shoulders press through a full arc",
      "Primary joint actions are shoulder abduction and shoulder flexion.",
      "shoulder_L.elev",
      60,
    ),
  ],
});
