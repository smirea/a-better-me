import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { powerRack } from "../equipment-library";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, plantFoot } from "../solver";

/** Upright on the floor, legs straight and spread, heels down. */
const SIT = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.24,
  "root.z": -0.02,
  "root.pitch": 2,
  "hip.flex": 72,
  "hip.abd": 18,
  "hip.rot": 4,
  "knee.flex": 36,
  "ankle.dorsi": 28,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "neck.flex": -6,
  "clavicle.prot": -6,
  "forearm.pron": 58,
  "wrist.flex": -4,
};

const RACK = {
  ...SIT,
  "clavicle.elev": 6,
  "shoulder.elev": 48,
  "shoulder.plane": 70,
  "shoulder.twist": 10,
  "elbow.flex": 96,
};

const LOCKOUT = {
  ...SIT,
  "neck.flex": 4,
  "clavicle.elev": 20,
  "shoulder.elev": 166,
  "shoulder.plane": 68,
  "shoulder.twist": -6,
  "elbow.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "barbell-z-press",
  catalogId: "1a05c6f170d8804191e6cdc4285a2aac",
  name: "Barbell Z Press",
  defaultLoadKg: 30,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Chest"],
  station: {
    kind: "seated",
    seatY: 0.14,
    feetMode: "hanging",
    leanDeg: 2,
    frame: { type: "box", height: 0.12 },
  },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.26,
    anchor: "press",
    path: { startY: 0.64, startZ: 0.16, endY: 1.18, endZ: 0.06, arcBulgeZ: 0.03 },
  },
  extraEquipment: powerRack({ hookY: 0.78, safetyY: 0.55, zCenter: 0.05, height: 1.7 }).parts,
  hints: { start: RACK, end: LOCKOUT },
  stiffness: { elbow: 3, shoulder: 2, lumbar: 7, knee: 5, hip: 3 },
  extraGoals: (body) => [
    ...plantFoot(body, "L", new Vector3(0.24, 0.045, 0.52), 0.08, 48),
    ...plantFoot(body, "R", new Vector3(-0.24, 0.045, 0.52), 0.08, 48),
    lockAngle(body, "ankle_L.dorsi", -22, 18),
    lockAngle(body, "ankle_R.dorsi", -22, 18),
  ],
  checks: () => [
    checkFlatBack("Sit tall. If the torso tips back, the press is lost."),
    checkJointRange("elbow-rom", "Press from the collarbone", "Press the bar up from the upper chest until the elbows straighten overhead.", "elbow_L.flex", 65),
    checkJointWithinAt("legs-straight", "Legs stay long", "Keep the knees nearly straight and the heels on the floor. Do not squat the weight up.", "knee_L.flex", "peak", 0, 100),
    checkJointWithinAt("upright", "Torso stays upright", "Do not lean back to move the bar.", "lumbar.flex", "peak", -15, 12),
    checkJointWithinAt("lockout-elbow", "Elbows locked out", "Finish with straight elbows and the bar over the shoulders and hips.", "elbow_L.flex", "peak", 0, 40),
    checkJointWithinAt("lockout-shoulder", "Shoulders flexed at lockout", "Lock out overhead without flipping the shoulders past a stacked position.", "shoulder_L.elev", "peak", 140, 174),
  ],
});
