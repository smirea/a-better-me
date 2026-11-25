import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** V-bar: closer than shoulder width, palms in, elbows point forward then drive back. */
const GRIP = {
  "shoulder.twist": 0,
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
  "shoulder.plane": 66,
  "elbow.flex": 5,
  "clavicle.elev": 12,
  "clavicle.prot": 4,
};

const DOWN = {
  ...GRIP,
  "shoulder.elev": 32,
  "shoulder.plane": 62,
  "elbow.flex": 112,
  "clavicle.elev": -8,
  "clavicle.prot": -14,
};

export const spec = buildExerciseSpec({
  id: "neutral-close-grip-cable-lat-pulldown",
  catalogId: "1a15c6f170d8808bbb8ecd9aae199152",
  name: "Neutral Close Grip Cable Lat Pulldown",
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
    attachment: "v-bar",
    gripX: 0.08,
    handPath: { startY: 1.5, startZ: 0.16, endY: 0.98, endZ: 0.28 },
  },
  hints: { start: { ...SEAT, ...UP }, end: { ...SEAT, ...DOWN } },
  checks: () => [
    checkFlatBack(
      "Maintain the slight backward lean of your torso you adopted while setting up, rather than leaning further backward.",
    ),
    checkNeutralNeck("Keep your neck quiet through the close-grip pulldown."),
    checkJointRange(
      "elbow-pull",
      "Elbows bend on the V-bar pulldown",
      "Pull the bar down toward your upper chest by driving your elbows down toward your sides as you progressively bend them.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "arms-overhead",
      "Arms start overhead and close",
      "Start with straight elbows and your arms overhead, slightly forward, in line with the cable.",
      "shoulder_L.elev",
      "top",
      115,
      178,
    ),
    checkJointWithinAt(
      "elbows-forward",
      "Elbows point forward rather than flare",
      "When your upper arms are in front of your body, the back of each elbow points predominantly forward rather than out to your sides.",
      "shoulder_L.plane",
      "bottom",
      42,
      90,
    ),
    checkJointWithinAt(
      "neutral-grip",
      "Palms face each other",
      "Grasp the V-bar with a neutral grip so your palms face each other.",
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
