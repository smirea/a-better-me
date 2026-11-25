import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Clearly outside shoulder width, overhand, elbows flare toward a T. */
const GRIP = {
  "shoulder.twist": 18,
  "forearm.pron": 78,
  "wrist.flex": 6,
  "wrist.dev": 4,
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
  id: "wide-grip-cable-row",
  catalogId: "1d15c6f170d880a886e3e2426f08d7eb",
  name: "Wide Grip Cable Row",
  defaultLoadKg: 14,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Chest", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.7, top: 0.35 },
  station: {
    kind: "seated",
    seatZ: -0.02,
    heelZ: 0.42,
    frame: { type: "seated-row", pulleyY: 0.74 },
    feetMode: "floor",
    leanDeg: 4,
  },
  apparatus: {
    kind: "cable-single",
    skipColumn: true,
    pulley: [0, 0.74, 1.25],
    facingDir: -1,
    attachment: "lat-bar",
    attachmentWidth: 0.92,
    gripX: 0.42,
  },
  hints: {
    start: {
      ...SEAT,
      ...GRIP,
      "shoulder.elev": 86,
      "shoulder.plane": 48,
      "elbow.flex": 8,
      "clavicle.prot": 8,
      "clavicle.elev": 8,
    },
    end: {
      ...SEAT,
      ...GRIP,
      "shoulder.elev": 74,
      "shoulder.plane": 12,
      "elbow.flex": 98,
      "clavicle.prot": -16,
      "clavicle.elev": 10,
    },
  },
  checks: () => [
    checkFlatBack(
      "Movement should occur at your shoulders, shoulder blades, and elbows, but your knees, hips, and lower back should remain nearly stationary.",
    ),
    checkNeutralNeck("Stay upright and keep your neck quiet."),
    checkJointRange(
      "elbow-row",
      "Elbows bend on the wide row",
      "Pull the bar back toward your torso by driving your elbows backward while simultaneously bending them.",
      "elbow_L.flex",
      65,
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms start outstretched",
      "Grasp the bar with an overhand wide grip and straight elbows.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "elbows-wide",
      "Upper arms flare toward a T",
      "Let your elbows flare so your upper arms finish closer to a T with your torso than tucked at your sides.",
      "shoulder_L.plane",
      "bottom",
      -40,
      35,
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
