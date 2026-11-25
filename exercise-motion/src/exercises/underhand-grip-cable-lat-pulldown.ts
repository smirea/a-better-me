import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Near shoulder-width supinated grip: palms face backward, elbows stay with the wrists. */
const GRIP = {
  "shoulder.twist": -14,
  "forearm.pron": -75,
  "wrist.flex": 4,
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
  "shoulder.elev": 160,
  "shoulder.plane": 70,
  "elbow.flex": 6,
  "clavicle.elev": 12,
  "clavicle.prot": 2,
};

const DOWN = {
  ...GRIP,
  "shoulder.elev": 36,
  "shoulder.plane": 56,
  "elbow.flex": 110,
  "clavicle.elev": -8,
  "clavicle.prot": -12,
};

export const spec = buildExerciseSpec({
  id: "underhand-grip-cable-lat-pulldown",
  catalogId: "1a15c6f170d880b2a97ec3d948120f99",
  name: "Underhand Grip Cable Lat Pulldown",
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
    attachment: "lat-bar",
    attachmentWidth: 0.7,
    gripX: 0.2,
    handPath: { startY: 1.58, startZ: 0.16, endY: 1.0, endZ: 0.26 },
  },
  hints: { start: { ...SEAT, ...UP }, end: { ...SEAT, ...DOWN } },
  checks: () => [
    checkFlatBack(
      "Maintain the slight backward lean of your torso you adopted while setting up, rather than leaning further backward.",
    ),
    checkNeutralNeck("Keep your neck quiet through the underhand pulldown."),
    checkJointRange(
      "elbow-pull",
      "Elbows bend on the underhand pulldown",
      "Pull the bar down toward your upper chest by driving your elbows down toward your sides as you progressively bend them.",
      "elbow_L.flex",
      70,
    ),
    checkJointWithinAt(
      "arms-overhead",
      "Arms start overhead",
      "Start with straight elbows and your arms overhead, slightly forward, in line with the cable.",
      "shoulder_L.elev",
      "top",
      130,
      175,
    ),
    checkJointWithinAt(
      "underhand",
      "Palms face backward",
      "Grasp the bar with a near shoulder-width underhand grip so your palms face backward.",
      "forearm_L.pron",
      "top",
      -100,
      -45,
    ),
    checkJointWithinAt(
      "elbows-in",
      "Elbows stay with the wrists",
      "Predominantly keep your elbows aligned with your wrists, rather than meaningfully flaring them out away from your sides.",
      "shoulder_L.plane",
      "bottom",
      38,
      85,
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
