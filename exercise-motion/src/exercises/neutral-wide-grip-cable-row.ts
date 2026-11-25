import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Wide parallel grip: palms face each other, elbows flare rather than tuck. */
const GRIP = {
  "shoulder.twist": 4,
  "forearm.pron": 0,
  "wrist.flex": 4,
  "wrist.dev": 0,
};

const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 4,
  "hip.flex": 86,
  "knee.flex": 70,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "neutral-wide-grip-cable-row",
  catalogId: "1d15c6f170d880809990ccd6b1a0cac0",
  name: "Neutral Wide Grip Cable Row",
  defaultLoadKg: 18,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Chest", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.7, top: 0.35 },
  station: {
    kind: "seated",
    seatZ: -0.02,
    heelZ: 0.42,
    frame: { type: "seated-row", pulleyY: 0.72 },
    feetMode: "floor",
    leanDeg: 4,
  },
  apparatus: {
    kind: "cable-single",
    skipColumn: true,
    pulley: [0, 0.72, 1.25],
    facingDir: -1,
    attachment: "straight-bar",
    attachmentWidth: 0.78,
    gripX: 0.3,
  },
  hints: {
    start: {
      ...SEAT,
      ...GRIP,
      "shoulder.elev": 88,
      "shoulder.plane": 70,
      "elbow.flex": 6,
      "clavicle.prot": 8,
      "clavicle.elev": 6,
    },
    end: {
      ...SEAT,
      ...GRIP,
      "shoulder.elev": 62,
      "shoulder.plane": 28,
      "elbow.flex": 118,
      "clavicle.prot": -16,
      "clavicle.elev": 8,
    },
  },
  checks: () => [
    checkFlatBack(
      "Movement should occur at your shoulders, shoulder blades, and elbows, but your knees, hips, and lower back should remain nearly stationary.",
    ),
    checkNeutralNeck("Sit upright and keep your neck quiet while you pull."),
    checkJointRange(
      "elbow-row",
      "Elbows bend through the row",
      "Pull the bar back toward your torso by driving your elbows backward while simultaneously bending them.",
      "elbow_L.flex",
      40,
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms start outstretched",
      "Grasp the parallel handles with straight elbows and a neutral grip, palms facing each other.",
      "elbow_L.flex",
      "top",
      0,
      70,
    ),
    checkJointWithinAt(
      "elbows-out",
      "Elbows flare away from the sides",
      "Allow your elbows naturally to flare out away from your sides rather than keeping them tucked.",
      "shoulder_L.plane",
      "bottom",
      -40,
      45,
    ),
    checkJointWithinAt(
      "scapulae-together",
      "Shoulder blades squeeze together",
      "Squeeze your shoulder blades together at the end of the pull as if you were trying to pinch a pencil between them.",
      "clavicle_L.prot",
      "bottom",
      -28,
      -6,
    ),
  ],
});
