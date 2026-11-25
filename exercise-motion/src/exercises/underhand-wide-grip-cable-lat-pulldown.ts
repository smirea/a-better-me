import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Modestly outside shoulder width, supinated. Wider than the standard underhand, short of a painful stretch. */
const GRIP = {
  "shoulder.twist": -10,
  "forearm.pron": -68,
  "wrist.flex": 6,
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
  "shoulder.plane": 52,
  "elbow.flex": 6,
  "clavicle.elev": 12,
  "clavicle.prot": 0,
};

const DOWN = {
  ...GRIP,
  "shoulder.elev": 46,
  "shoulder.plane": 36,
  "elbow.flex": 100,
  "clavicle.elev": -8,
  "clavicle.prot": -10,
};

export const spec = buildExerciseSpec({
  id: "underhand-wide-grip-cable-lat-pulldown",
  catalogId: "1ca5c6f170d880de9d4efa853805659e",
  name: "Underhand Wide Grip Cable Lat Pulldown",
  defaultLoadKg: 36,
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
    attachmentWidth: 0.86,
    gripX: 0.32,
    handPath: { startY: 1.6, startZ: 0.14, endY: 1.02, endZ: 0.25 },
  },
  hints: { start: { ...SEAT, ...UP }, end: { ...SEAT, ...DOWN } },
  checks: () => [
    checkFlatBack(
      "Maintain the slight backward lean of your torso you adopted while setting up, rather than leaning further backward.",
    ),
    checkNeutralNeck("Keep your neck quiet through the wide underhand pulldown."),
    checkJointRange(
      "elbow-pull",
      "Elbows bend on the wide underhand pull",
      "Pull the bar down toward your upper chest by driving your elbows down toward your sides as you progressively bend them.",
      "elbow_L.flex",
      65,
    ),
    checkJointWithinAt(
      "arms-overhead",
      "Arms start overhead",
      "Start with straight elbows and your arms overhead, slightly forward, in line with the cable.",
      "shoulder_L.elev",
      "top",
      115,
      175,
    ),
    checkJointWithinAt(
      "underhand",
      "Palms face backward",
      "Grasp the bar outside shoulder width with an underhand grip so your palms face backward.",
      "forearm_L.pron",
      "top",
      -100,
      -40,
    ),
    checkJointWithinAt(
      "elbows-down",
      "Elbows finish bent at the chest",
      "Finish with the bar at your upper chest and your elbows bent.",
      "elbow_L.flex",
      "bottom",
      75,
      130,
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
