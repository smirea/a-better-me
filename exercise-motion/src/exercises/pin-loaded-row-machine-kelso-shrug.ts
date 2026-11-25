import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/** Chest on a pin-loaded row pad. Straight arms, short handle travel from scapular retraction. */
const ARMS = {
  "shoulder.elev": 76,
  "shoulder.plane": 70,
  "shoulder.twist": 6,
  "elbow.flex": 6,
  "forearm.pron": 12,
  "wrist.flex": 2,
  "clavicle.elev": 4,
};

const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 6,
  "hip.flex": 88,
  "knee.flex": 78,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "pin-loaded-row-machine-kelso-shrug",
  catalogId: "2925c6f170d8809688d0f17e8a1a3328",
  name: "Pin-Loaded Row Machine Kelso Shrug",
  defaultLoadKg: 18,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Retract", "Pinch", "Release", "Stretch"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.5, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.5,
    seatZ: -0.04,
    heelZ: 0.36,
    frame: { type: "machine", chestPadZ: 0.28, chestPadY: 1.0, stackZ: -0.9 },
    feetMode: "floor",
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    forceDir: [0, 0, 1],
    gripX: 0.2,
  },
  stiffness: { elbow: 8, shoulder: 2.6, lumbar: 8, clavicle: 0.65 },
  hints: {
    start: { ...SEAT, ...ARMS, "clavicle.prot": 16 },
    end: { ...SEAT, ...ARMS, "shoulder.elev": 72, "clavicle.prot": -18 },
  },
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "elbow_L.flex", 6, 40),
      lockAngle(body, "elbow_R.flex", 6, 40),
      lockAngle(body, "clavicle_L.prot", 16, 40),
      lockAngle(body, "clavicle_R.prot", 16, 40),
    ],
    end: [
      lockAngle(body, "elbow_L.flex", 6, 40),
      lockAngle(body, "elbow_R.flex", 6, 40),
      lockAngle(body, "clavicle_L.prot", -18, 30),
      lockAngle(body, "clavicle_R.prot", -18, 30),
    ],
  }),
  checks: () => [
    checkFlatBack("Keep the chest snug on the pad. Do not lean back to move the handles."),
    checkNeutralNeck("Keep the neck quiet against the chest pad."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay extended",
      "Reach fully forward with straight elbows, and keep them straight while the shoulder blades move.",
      "elbow_L.flex",
      "peak",
      0,
      20,
    ),
    checkJointWithinAt(
      "protracted",
      "Shoulder blades start pushed forward",
      "Set the chest pad so the handles are just in reach with the shoulder blades pushed forward and apart.",
      "clavicle_L.prot",
      "top",
      6,
      28,
    ),
    checkJointWithinAt(
      "retracted",
      "Shoulder blades pinch",
      "Pull the shoulder blades backward and in toward each other. The handles only move a short distance.",
      "clavicle_L.prot",
      "bottom",
      -30,
      -8,
    ),
    checkJointRange(
      "scapular-retraction",
      "Shoulder blades travel from stretch to pinch",
      "Let the shoulder blades spread forward, then pinch them together without bending the elbows.",
      "clavicle_L.prot",
      16,
    ),
  ],
});
