import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Slightly outside shoulder width, palms down, elbows free to flare a little. */
const GRIP = {
  "shoulder.twist": 16,
  "forearm.pron": 75,
  "wrist.flex": 6,
  "wrist.dev": 2,
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
  id: "overhand-grip-cable-row",
  catalogId: "1a15c6f170d8802facb6eb0a316ae895",
  name: "Overhand Grip Cable Row",
  defaultLoadKg: 20,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Chest", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.7, top: 0.35 },
  station: {
    kind: "seated",
    seatZ: -0.02,
    heelZ: 0.42,
    frame: { type: "seated-row", pulleyY: 0.7 },
    feetMode: "floor",
    leanDeg: 4,
  },
  apparatus: {
    kind: "cable-single",
    skipColumn: true,
    pulley: [0, 0.7, 1.25],
    facingDir: -1,
    attachment: "straight-bar",
    attachmentWidth: 0.7,
    gripX: 0.28,
  },
  hints: {
    start: {
      ...SEAT,
      ...GRIP,
      "shoulder.elev": 80,
      "shoulder.plane": 64,
      "elbow.flex": 8,
      "clavicle.prot": 8,
      "clavicle.elev": 6,
    },
    end: {
      ...SEAT,
      ...GRIP,
      "shoulder.elev": 48,
      "shoulder.plane": 36,
      "elbow.flex": 108,
      "clavicle.prot": -16,
      "clavicle.elev": 8,
    },
  },
  checks: () => [
    checkFlatBack(
      "Movement should occur at your shoulders, shoulder blades, and elbows, but your knees, hips, and lower back should remain nearly stationary.",
    ),
    checkNeutralNeck("Stay upright and keep your neck quiet."),
    checkJointRange(
      "elbow-row",
      "Elbows bend through the overhand row",
      "Pull the bar back toward your torso by driving your elbows backward while simultaneously bending them.",
      "elbow_L.flex",
      70,
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms start outstretched",
      "Grasp the bar with straight elbows and a slightly outside shoulder-width overhand grip.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "overhand",
      "Palms face down",
      "Hold the bar overhand so your palms face down.",
      "forearm_L.pron",
      "top",
      50,
      100,
    ),
    checkJointWithinAt(
      "scapulae-together",
      "Shoulder blades pull together",
      "Squeeze your shoulder blades together at the end of the pull.",
      "clavicle_L.prot",
      "bottom",
      -28,
      -6,
    ),
  ],
});
