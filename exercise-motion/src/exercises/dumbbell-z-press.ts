import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, plantFoot } from "../solver";

/** Upright on the floor, legs long and spread, heels down, elbows flared. */
const SIT = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.22,
  "root.z": 0.02,
  "root.pitch": 4,
  "hip.flex": 70,
  "hip.abd": 16,
  "hip.rot": 2,
  "knee.flex": 28,
  "ankle.dorsi": 4,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "neck.flex": -4,
};

const RACK = {
  ...SIT,
  "clavicle.elev": 8,
  "clavicle.prot": -6,
  "shoulder.elev": 72,
  "shoulder.plane": 58,
  "shoulder.twist": 12,
  "elbow.flex": 96,
  "forearm.pron": 68,
  "wrist.flex": 4,
};

const LOCKOUT = {
  ...SIT,
  "neck.flex": 2,
  "clavicle.elev": 18,
  "clavicle.prot": 2,
  "shoulder.elev": 166,
  "shoulder.plane": 22,
  "shoulder.twist": 6,
  "elbow.flex": 6,
  "forearm.pron": 64,
  "wrist.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-z-press",
  catalogId: "1a05c6f170d88029aa15d08f03a7bd5a",
  name: "Dumbbell Z Press",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Shoulders"],
  station: {
    kind: "seated",
    seatY: 0.2,
    feetMode: "hanging",
    leanDeg: 4,
    frame: { type: "box", height: 0.18 },
  },
  apparatus: { kind: "dumbbells", anchor: "press" },
  hints: { start: RACK, end: LOCKOUT },
  stiffness: { elbow: 3, shoulder: 1.4, lumbar: 7, knee: 5, hip: 3 },
  extraGoals: (body) => [
    ...plantFoot(body, "L", new Vector3(0.22, 0.04, 0.6), 0.1, 60),
    ...plantFoot(body, "R", new Vector3(-0.22, 0.04, 0.6), 0.1, 60),
    lockAngle(body, "lumbar.flex", -4, 28),
  ],
  checks: () => [
    checkFlatBack("Sit tall. Do not let the torso tip backward or slouch."),
    checkJointRange(
      "elbow-rom",
      "Press from the shoulders",
      "Press the dumbbells from beside the shoulders until the elbows straighten.",
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
      "Do not lean back to move the dumbbells.",
      "lumbar.flex",
      "peak",
      -20,
      16,
    ),
    checkJointWithinAt(
      "lockout-elbow",
      "Elbows locked out",
      "Finish with straight elbows and the dumbbells over the shoulders.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "lockout-shoulder",
      "Shoulders flexed at lockout",
      "Lock out overhead without tipping the torso back.",
      "shoulder_L.elev",
      "peak",
      140,
      175,
    ),
  ],
});
