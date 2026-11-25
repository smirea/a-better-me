import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Wide parallel handles: palms in, arms in a Y, pull is mostly shoulder adduction. */
const GRIP = {
  "shoulder.twist": 4,
  "forearm.pron": 0,
  "wrist.flex": 2,
};

const SEAT = {
  ...POSTURE_HINTS.seatedLeanBack,
  "root.pitch": -12,
  "hip.flex": 82,
  "knee.flex": 92,
  "lumbar.flex": 2,
  "thoracic.flex": -2,
  "neck.flex": -6,
};

const UP = {
  ...GRIP,
  "shoulder.elev": 148,
  "shoulder.plane": 40,
  "elbow.flex": 6,
  "clavicle.elev": 14,
  "clavicle.prot": 0,
};

const DOWN = {
  ...GRIP,
  "shoulder.elev": 56,
  "shoulder.plane": 24,
  "elbow.flex": 96,
  "clavicle.elev": -8,
  "clavicle.prot": -8,
};

export const spec = buildExerciseSpec({
  id: "neutral-wide-grip-cable-lat-pulldown",
  catalogId: "1ca5c6f170d880a3bd11ce80391ac1ef",
  name: "Neutral Wide Grip Cable Lat Pulldown",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Chest", "Return", "Reach"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.8, top: 0.4 },
  station: {
    kind: "seated",
    seatY: 0.44,
    seatZ: -0.02,
    stanceX: 0.16,
    heelZ: 0.34,
    leanDeg: -12,
    frame: { type: "lat-pulldown", thighPadY: 0.62, pulleyZ: 0.16 },
    feetMode: "floor",
  },
  apparatus: {
    kind: "cable-single",
    skipColumn: true,
    pulley: [0, 2.18, 0.16],
    facingDir: -1,
    attachment: "straight-bar",
    attachmentWidth: 0.86,
    gripX: 0.36,
    handPath: { startY: 1.48, startZ: 0.14, endY: 1.05, endZ: 0.24 },
  },
  hints: { start: { ...SEAT, ...UP }, end: { ...SEAT, ...DOWN } },
  checks: () => [
    checkFlatBack(
      "Maintain the slight backward lean of your torso you adopted while setting up, rather than leaning further backward.",
    ),
    checkNeutralNeck("Keep your neck quiet through the wide neutral pulldown."),
    checkJointRange(
      "elbow-pull",
      "Elbows bend on the wide neutral pull",
      "Pull the handles down toward your upper chest by driving your elbows down toward your sides as you progressively bend them.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "arms-y",
      "Arms start wide and overhead",
      "Start with straight elbows and your arms overhead and slightly forward.",
      "shoulder_L.elev",
      "top",
      125,
      175,
    ),
    checkJointWithinAt(
      "neutral-grip",
      "Palms face each other",
      "Grasp the outside-shoulder-width handles with a neutral grip so your palms face each other.",
      "forearm_L.pron",
      "top",
      -25,
      25,
    ),
    checkJointWithinAt(
      "elbows-wide",
      "Elbows travel on a wide path",
      "Drive the elbows down through shoulder adduction so the handles finish at the upper chest.",
      "shoulder_L.plane",
      "bottom",
      0,
      45,
    ),
    checkJointWithinAt(
      "scapulae-down",
      "Shoulder blades pull down",
      "Simultaneously pull your shoulder blades down away from your ears.",
      "clavicle_L.elev",
      "bottom",
      -22,
      4,
    ),
  ],
});
