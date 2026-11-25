import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

/** Neutral handles point forward. Elbows stay under the wrists and drive up in front of the body. */
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
  "shoulder.elev": 62,
  "shoulder.plane": 78,
  "shoulder.twist": 6,
  "elbow.flex": 96,
  "forearm.pron": 8,
  "wrist.flex": 2,
};

const ARMS_TOP = {
  "clavicle.elev": 16,
  "clavicle.prot": 0,
  "shoulder.elev": 158,
  "shoulder.plane": 70,
  "shoulder.twist": 2,
  "elbow.flex": 8,
  "forearm.pron": 8,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "neutral-grip-pin-loaded-machine-shoulder-press",
  catalogId: "1a15c6f170d880a19fdfee37bb2e5ee3",
  name: "Neutral Grip Pin-Loaded Machine Shoulder Press",
  defaultLoadKg: 25,
  loadUnit: "total",
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
    forceDir: [0, 1, 0.08],
  },
  hints: { start: { ...SEAT, ...ARMS_BOTTOM }, end: { ...SEAT, ...ARMS_TOP } },
  stiffness: { elbow: 3, shoulder: 1.8, lumbar: 6 },
  checks: () => [
    checkFeetPlanted("Keep the back snug against the pad and both feet planted."),
    checkJointRange(
      "elbow-rom",
      "Press the neutral handles overhead",
      "Press until the elbows straighten, then lower until the handles are slightly above the shoulders.",
      "elbow_L.flex",
      65,
    ),
    checkJointWithinAt(
      "bottom-elbow",
      "Elbows start under the handles",
      "Start with the elbows stacked under the forward handles so the forearms are vertical from the side.",
      "elbow_L.flex",
      "start",
      70,
      120,
    ),
    checkJointWithinAt(
      "lockout-elbow",
      "Elbows finish straight",
      "Press the handles overhead until the elbows are straightened, driving up in front of the body.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "neutral-grip",
      "Palms face each other",
      "Grasp the forward handles with the palms facing in. This is a neutral grip, not an overhand grip.",
      "forearm_L.pron",
      "start",
      0,
      30,
    ),
  ],
});
