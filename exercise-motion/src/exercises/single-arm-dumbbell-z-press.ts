import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, plantFoot } from "../solver";

const SIT = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.22,
  "root.z": 0.02,
  "root.pitch": 4,
  "hip.flex": 70,
  "hip.abd": 18,
  "hip.rot": 2,
  "knee.flex": 28,
  "ankle.dorsi": 4,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "neck.flex": -4,
};

const WORK_BOTTOM = {
  "clavicle.elev": 8,
  "clavicle.prot": -6,
  "shoulder.elev": 72,
  "shoulder.plane": 58,
  "shoulder.twist": 12,
  "elbow.flex": 96,
  "forearm.pron": 68,
  "wrist.flex": 4,
};

const WORK_TOP = {
  "clavicle.elev": 18,
  "clavicle.prot": 2,
  "shoulder.elev": 166,
  "shoulder.plane": 22,
  "shoulder.twist": 6,
  "elbow.flex": 6,
  "forearm.pron": 64,
  "wrist.flex": 2,
};

const REST = {
  "clavicle.elev": 6,
  "clavicle.prot": 4,
  "shoulder.elev": 72,
  "shoulder.plane": 78,
  "shoulder.twist": 8,
  "elbow.flex": 18,
  "forearm.pron": 8,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "single-arm-dumbbell-z-press",
  catalogId: "2265c6f170d8801388daf25ba257a0c3",
  name: "Single Arm Dumbbell Z Press",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Shoulder"],
  station: {
    kind: "seated",
    seatY: 0.2,
    feetMode: "hanging",
    leanDeg: 4,
    frame: { type: "box", height: 0.18 },
  },
  apparatus: { kind: "dumbbells", sides: ["L"], anchor: "press" },
  hints: {
    start: sidedHints("L", WORK_BOTTOM, REST, SIT),
    end: sidedHints("L", WORK_TOP, REST, { ...SIT, "neck.flex": 2 }),
  },
  stiffness: { elbow: 3, shoulder: 1.4, lumbar: 7, knee: 5, hip: 3 },
  extraGoals: (body) => [
    ...plantFoot(body, "L", new Vector3(0.24, 0.04, 0.6), 0.1, 60),
    ...plantFoot(body, "R", new Vector3(-0.24, 0.04, 0.6), 0.1, 60),
    lockAngle(body, "lumbar.flex", -4, 28),
  ],
  checks: () => [
    checkFlatBack("Sit tall. Do not let the torso tip backward."),
    checkJointRange(
      "elbow-rom",
      "Press from the shoulder",
      "Press the dumbbell from beside the shoulder until the elbow straightens.",
      "elbow_L.flex",
      65,
    ),
    checkJointWithinAt(
      "legs-long",
      "Legs stay long",
      "Keep the knees nearly straight and the heels on the floor.",
      "knee_L.flex",
      "peak",
      10,
      80,
    ),
    checkJointWithinAt(
      "upright",
      "Torso stays upright",
      "Do not lean back to move the dumbbell.",
      "lumbar.flex",
      "peak",
      -20,
      16,
    ),
    checkJointWithinAt(
      "lockout-elbow",
      "Working elbow locked out",
      "Finish with a straight elbow and the dumbbell over the shoulder.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "lockout-shoulder",
      "Working shoulder flexed at lockout",
      "Lock out overhead without tipping the torso back.",
      "shoulder_L.elev",
      "peak",
      140,
      175,
    ),
  ],
});
