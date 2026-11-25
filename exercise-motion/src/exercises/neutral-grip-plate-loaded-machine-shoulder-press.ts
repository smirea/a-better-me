import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

/** Neutral plate-loaded press: handles angled forward, elbows drive up in front of the torso. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 2,
  "lumbar.flex": -3,
  "thoracic.flex": -2,
  "neck.flex": 6,
};

const ARMS_BOTTOM = {
  "clavicle.elev": 4,
  "clavicle.prot": -2,
  "shoulder.elev": 64,
  "shoulder.plane": 76,
  "shoulder.twist": 6,
  "elbow.flex": 96,
  "forearm.pron": 12,
  "wrist.flex": 2,
};

const ARMS_TOP = {
  "clavicle.elev": 16,
  "clavicle.prot": 0,
  "shoulder.elev": 156,
  "shoulder.plane": 68,
  "shoulder.twist": 2,
  "elbow.flex": 8,
  "forearm.pron": 10,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "neutral-grip-plate-loaded-machine-shoulder-press",
  catalogId: "1a15c6f170d88076b7f5e24347a8d8a0",
  name: "Neutral Grip Plate-Loaded Machine Shoulder Press",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Shoulders"],
  station: {
    kind: "seated",
    seatY: 0.46,
    stanceX: 0.18,
    heelZ: 0.4,
    leanDeg: 2,
    pinBack: true,
    frame: { type: "machine", backAngleDeg: 84, stackZ: -0.62 },
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    anchor: "press",
    forceDir: [0, 1, 0.1],
  },
  hints: { start: { ...SEAT, ...ARMS_BOTTOM }, end: { ...SEAT, ...ARMS_TOP } },
  stiffness: { elbow: 3, shoulder: 1.8, lumbar: 6 },
  checks: () => [
    checkFeetPlanted("Keep the back snug against the pad and both feet planted."),
    checkJointRange(
      "elbow-rom",
      "Press the neutral handles overhead",
      "Press until the elbows straighten, then lower until the handles sit slightly above the shoulders.",
      "elbow_L.flex",
      65,
    ),
    checkJointWithinAt(
      "bottom-elbow",
      "Elbows start under the handles",
      "Stack the elbows under the forward handles so the forearms stay vertical from the side.",
      "elbow_L.flex",
      "start",
      70,
      120,
    ),
    checkJointWithinAt(
      "lockout-elbow",
      "Elbows finish straight",
      "Drive the elbows up in front of the body until they are straight, rather than flaring them out to the sides.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "neutral-grip",
      "Palms face each other",
      "Grasp the forward handles with the palms facing in. Side-facing overhand handles are a different variation.",
      "forearm_L.pron",
      "start",
      0,
      35,
    ),
  ],
});
