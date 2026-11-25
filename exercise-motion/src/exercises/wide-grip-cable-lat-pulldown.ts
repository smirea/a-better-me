import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Well outside shoulder width, overhand, arms form a Y and finish with elbows flared. */
const GRIP = {
  "shoulder.twist": 16,
  "forearm.pron": 74,
  "wrist.flex": -4,
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
  "shoulder.elev": 162,
  "shoulder.plane": 48,
  "elbow.flex": 4,
  "clavicle.elev": 14,
  "clavicle.prot": -2,
};

const DOWN = {
  ...GRIP,
  "shoulder.elev": 58,
  "shoulder.plane": 22,
  "elbow.flex": 92,
  "clavicle.elev": -8,
  "clavicle.prot": -10,
};

export const spec = buildExerciseSpec({
  id: "wide-grip-cable-lat-pulldown",
  catalogId: "1a15c6f170d8809d8cdbf9394bfb079c",
  name: "Wide Grip Cable Lat Pulldown",
  defaultLoadKg: 42,
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
    attachmentWidth: 1.05,
    gripX: 0.4,
    handPath: { startY: 1.6, startZ: 0.12, endY: 1.06, endZ: 0.24 },
  },
  hints: { start: { ...SEAT, ...UP }, end: { ...SEAT, ...DOWN } },
  checks: () => [
    checkFlatBack(
      "Maintain the slight backward lean of your torso you adopted while setting up, rather than leaning further backward.",
    ),
    checkNeutralNeck("Keep your neck quiet through the wide pulldown."),
    checkJointRange(
      "elbow-pull",
      "Elbows bend on the wide pulldown",
      "Pull the bar down toward your upper chest by driving your elbows down toward your sides as you progressively bend them.",
      "elbow_L.flex",
      55,
    ),
    checkJointWithinAt(
      "arms-y",
      "Arms start in a Y",
      "Grasp the bar well outside shoulder width so your arms form a Y with your torso, elbows straight.",
      "shoulder_L.elev",
      "top",
      118,
      175,
    ),
    checkJointWithinAt(
      "overhand",
      "Palms face forward",
      "Use an overhand grip so your palms are directed forward.",
      "forearm_L.pron",
      "top",
      45,
      100,
    ),
    checkJointWithinAt(
      "elbows-wide",
      "Elbows travel out on the wide path",
      "Drive your elbows down toward your sides through shoulder adduction rather than a close tuck.",
      "shoulder_L.plane",
      "bottom",
      0,
      42,
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
