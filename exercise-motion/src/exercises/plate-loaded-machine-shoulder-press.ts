import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

/** Overhand plate-loaded press: handles out to the sides, elbows flare under the wrists. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 2,
  "lumbar.flex": -3,
  "thoracic.flex": -2,
  "neck.flex": 6,
};

const ARMS_BOTTOM = {
  "clavicle.elev": 6,
  "clavicle.prot": -6,
  "shoulder.elev": 68,
  "shoulder.plane": 42,
  "shoulder.twist": 14,
  "elbow.flex": 94,
  "forearm.pron": 72,
  "wrist.flex": 4,
};

const ARMS_TOP = {
  "clavicle.elev": 18,
  "clavicle.prot": 2,
  "shoulder.elev": 164,
  "shoulder.plane": 22,
  "shoulder.twist": 6,
  "elbow.flex": 8,
  "forearm.pron": 68,
  "wrist.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "plate-loaded-machine-shoulder-press",
  catalogId: "1a15c6f170d880208cfdca4035bdedab",
  name: "Plate-Loaded Machine Shoulder Press",
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
    orientation: "horizontal",
    anchor: "press",
    forceDir: [0, 1, 0.05],
  },
  hints: { start: { ...SEAT, ...ARMS_BOTTOM }, end: { ...SEAT, ...ARMS_TOP } },
  stiffness: { elbow: 3, shoulder: 1.6, lumbar: 6 },
  checks: () => [
    checkFeetPlanted("Keep the back snug against the pad and both feet planted."),
    checkJointRange(
      "elbow-rom",
      "Press the handles overhead",
      "Drive the elbows upward and inward until they straighten, then lower until the handles are near shoulder level.",
      "elbow_L.flex",
      65,
    ),
    checkJointWithinAt(
      "bottom-elbow",
      "Elbows start under the handles",
      "Start with the elbows stacked under the side handles so the forearms are vertical from the side.",
      "elbow_L.flex",
      "start",
      70,
      120,
    ),
    checkJointWithinAt(
      "lockout-elbow",
      "Elbows finish straight",
      "Press until the elbows are straightened and the handles are overhead.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "overhand",
      "Palms face forward",
      "Grasp the handles that point out to the sides with the palms facing forward.",
      "forearm_L.pron",
      "start",
      50,
      90,
    ),
    checkJointWithinAt(
      "overhead",
      "Shoulders finish flexed",
      "The press is shoulder abduction with flexion. Finish with the arms overhead.",
      "shoulder_L.elev",
      "peak",
      135,
      175,
    ),
  ],
});
