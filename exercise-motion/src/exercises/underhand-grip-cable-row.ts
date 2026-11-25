import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Shoulder-width underhand: palms up, elbows tucked. Cable bars have no wrist-align flag. */
const GRIP = {
  "shoulder.twist": -12,
  "forearm.pron": -75,
  "wrist.flex": 6,
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
  id: "underhand-grip-cable-row",
  catalogId: "1a15c6f170d880e89f71c03312fd37ba",
  name: "Underhand Grip Cable Row",
  defaultLoadKg: 20,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Stomach", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.7, top: 0.35 },
  station: {
    kind: "seated",
    seatZ: -0.02,
    heelZ: 0.42,
    frame: { type: "seated-row", pulleyY: 0.66 },
    feetMode: "floor",
    leanDeg: 4,
  },
  apparatus: {
    kind: "cable-single",
    skipColumn: true,
    pulley: [0, 0.66, 1.25],
    facingDir: -1,
    attachment: "straight-bar",
    attachmentWidth: 0.62,
    gripX: 0.2,
  },
  hints: {
    start: {
      ...SEAT,
      ...GRIP,
      "shoulder.elev": 76,
      "shoulder.plane": 80,
      "elbow.flex": 8,
      "clavicle.prot": 6,
      "clavicle.elev": 4,
    },
    end: {
      ...SEAT,
      ...GRIP,
      "shoulder.elev": 32,
      "shoulder.plane": 52,
      "elbow.flex": 114,
      "clavicle.prot": -16,
      "clavicle.elev": 4,
    },
  },
  checks: () => [
    checkFlatBack(
      "Movement should occur at your shoulders, shoulder blades, and elbows, but your knees, hips, and lower back should remain nearly stationary.",
    ),
    checkNeutralNeck("Stay upright and keep your neck quiet."),
    checkJointRange(
      "elbow-row",
      "Elbows bend on the underhand row",
      "Pull the bar back toward your torso by driving your elbows backward while simultaneously bending them.",
      "elbow_L.flex",
      75,
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms start straight",
      "Grasp the bar with a near shoulder-width underhand grip and straight elbows.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "underhand",
      "Palms face up",
      "Hold the bar underhand so your palms face upward.",
      "forearm_L.pron",
      "top",
      -100,
      -45,
    ),
    checkJointWithinAt(
      "elbows-in",
      "Elbows stay near the sides",
      "Keep your elbows tucked fairly close to your sides with this underhand grip.",
      "shoulder_L.plane",
      "bottom",
      -40,
      80,
    ),
  ],
});
