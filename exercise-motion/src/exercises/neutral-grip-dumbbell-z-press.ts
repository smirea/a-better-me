import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, plantFoot } from "../solver";

/** Same floor seat as the flared Z press, with the palms facing each other and the elbows in front. */
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
  "clavicle.prot": -10,
  "shoulder.elev": 72,
  "shoulder.plane": 82,
  "shoulder.twist": 2,
  "elbow.flex": 98,
  "forearm.pron": 2,
  "wrist.flex": 4,
};

const LOCKOUT = {
  ...SIT,
  "neck.flex": 2,
  "clavicle.elev": 18,
  "clavicle.prot": -2,
  "shoulder.elev": 164,
  "shoulder.plane": 68,
  "shoulder.twist": 0,
  "elbow.flex": 6,
  "forearm.pron": 4,
  "wrist.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "neutral-grip-dumbbell-z-press",
  catalogId: "2265c6f170d880078a82ff879d04021f",
  name: "Neutral Grip Dumbbell Z Press",
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
  stiffness: { elbow: 3, shoulder: 1.4, lumbar: 7, knee: 5, hip: 3, forearm: 2.4 },
  extraGoals: (body) => [
    ...plantFoot(body, "L", new Vector3(0.22, 0.04, 0.6), 0.1, 60),
    ...plantFoot(body, "R", new Vector3(-0.22, 0.04, 0.6), 0.1, 60),
    lockAngle(body, "lumbar.flex", -4, 28),
  ],
  checks: () => [
    checkFlatBack("Sit tall with the heels down. Do not rock the torso back."),
    checkJointRange(
      "elbow-rom",
      "Press from the front of the shoulders",
      "Press the dumbbells up while the palms stay facing each other.",
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
      "The elbows arc back until the bells sit over the shoulders.",
      "shoulder_L.elev",
      "peak",
      140,
      175,
    ),
    {
      id: "neutral-grip",
      label: "Palms stay facing in",
      cue: "Keep the palms facing each other for the whole press.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["forearm_L.pron"])), 28, "° away from a neutral forearm"),
    },
  ],
});
