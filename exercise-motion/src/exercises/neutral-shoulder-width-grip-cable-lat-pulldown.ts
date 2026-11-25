import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Shoulder-width parallel handles: palms face each other, elbows stay near the ribs. */
const GRIP = {
  "shoulder.twist": 2,
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
  "shoulder.elev": 158,
  "shoulder.plane": 68,
  "elbow.flex": 6,
  "clavicle.elev": 12,
  "clavicle.prot": 2,
};

const DOWN = {
  ...GRIP,
  "shoulder.elev": 38,
  "shoulder.plane": 58,
  "elbow.flex": 108,
  "clavicle.elev": -8,
  "clavicle.prot": -12,
};

export const spec = buildExerciseSpec({
  id: "neutral-shoulder-width-grip-cable-lat-pulldown",
  catalogId: "1ca5c6f170d88029b5f6c3464d50ea03",
  name: "Neutral Shoulder Width Grip Cable Lat Pulldown",
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
    attachmentWidth: 0.52,
    gripX: 0.2,
    handPath: { startY: 1.58, startZ: 0.16, endY: 1.02, endZ: 0.26 },
  },
  hints: { start: { ...SEAT, ...UP }, end: { ...SEAT, ...DOWN } },
  checks: () => [
    checkFlatBack(
      "Maintain the slight backward lean of your torso you adopted while setting up, rather than leaning further backward.",
    ),
    checkNeutralNeck("Keep your neck quiet while your shoulder blades move with the pull."),
    checkJointRange(
      "elbow-pull",
      "Elbows bend as the handles come to the chest",
      "Pull the handles down toward your upper chest by driving your elbows down toward your sides as you progressively bend them.",
      "elbow_L.flex",
      70,
    ),
    checkJointWithinAt(
      "arms-overhead",
      "Arms start overhead",
      "Start with straight elbows, arms overhead and slightly forward, in line with the cable.",
      "shoulder_L.elev",
      "top",
      130,
      175,
    ),
    checkJointWithinAt(
      "elbows-in",
      "Elbows stay aligned with the wrists",
      "Predominantly keep your elbows aligned with your wrists, rather than meaningfully flaring them out away from your sides.",
      "shoulder_L.plane",
      "bottom",
      40,
      85,
    ),
    checkJointWithinAt(
      "neutral-grip",
      "Palms face each other",
      "Grasp the handles with a neutral grip, such that your palms face each other.",
      "forearm_L.pron",
      "top",
      -25,
      25,
    ),
    checkJointWithinAt(
      "scapulae-down",
      "Shoulder blades pull down",
      "Simultaneously pull your shoulder blades down away from your ears.",
      "clavicle_L.elev",
      "bottom",
      -22,
      2,
    ),
  ],
});
