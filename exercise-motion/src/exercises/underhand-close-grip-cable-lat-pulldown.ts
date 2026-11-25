import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Closer than a standard underhand pulldown. Palms face back and elbows stay in front. */
const GRIP = {
  "shoulder.twist": -16,
  "forearm.pron": -78,
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
  "shoulder.elev": 148,
  "shoulder.plane": 66,
  "elbow.flex": 6,
  "clavicle.elev": 12,
  "clavicle.prot": 4,
};

const DOWN = {
  ...GRIP,
  "shoulder.elev": 32,
  "shoulder.plane": 64,
  "elbow.flex": 114,
  "clavicle.elev": -8,
  "clavicle.prot": -14,
};

export const spec = buildExerciseSpec({
  id: "underhand-close-grip-cable-lat-pulldown",
  catalogId: "1a15c6f170d880498730f15feec5e557",
  name: "Underhand Close Grip Cable Lat Pulldown",
  defaultLoadKg: 28,
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
    attachmentWidth: 0.4,
    gripX: 0.11,
    handPath: { startY: 1.5, startZ: 0.16, endY: 0.98, endZ: 0.28 },
  },
  hints: { start: { ...SEAT, ...UP }, end: { ...SEAT, ...DOWN } },
  checks: () => [
    checkFlatBack(
      "Maintain the slight backward lean of your torso rather than leaning further backward as you pull.",
    ),
    checkNeutralNeck("Keep your neck quiet through the close underhand pulldown."),
    checkJointRange(
      "elbow-pull",
      "Elbows bend on the close underhand pull",
      "Pull the bar down toward your upper chest by driving your elbows down toward your sides as you progressively bend them.",
      "elbow_L.flex",
      58,
    ),
    checkJointWithinAt(
      "arms-overhead",
      "Arms start overhead",
      "Start with straight elbows and your arms overhead, slightly forward, in line with the cable.",
      "shoulder_L.elev",
      "top",
      110,
      178,
    ),
    checkJointWithinAt(
      "underhand",
      "Palms face backward",
      "Grasp the bar closer than shoulder width with an underhand grip so your palms face backward.",
      "forearm_L.pron",
      "top",
      -105,
      -45,
    ),
    checkJointWithinAt(
      "elbows-forward",
      "Elbows point forward",
      "When your upper arms are about parallel with the ground, the back of each elbow points forward rather than out to the sides.",
      "shoulder_L.plane",
      "bottom",
      42,
      90,
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
