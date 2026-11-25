import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Wide overhand bar travels behind the head. Upright torso, chin nodded toward the chest. */
const GRIP = {
  "shoulder.twist": 18,
  "forearm.pron": 76,
  "wrist.flex": -2,
};

const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.z": -0.02,
  "root.pitch": -4,
  "hip.flex": 88,
  "knee.flex": 94,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 16,
};

const UP = {
  ...GRIP,
  "shoulder.elev": 155,
  "shoulder.plane": 36,
  "elbow.flex": 6,
  "clavicle.elev": 14,
  "clavicle.prot": -4,
};

const DOWN = {
  ...GRIP,
  "shoulder.elev": 78,
  "shoulder.plane": 16,
  "elbow.flex": 88,
  "clavicle.elev": -6,
  "clavicle.prot": -6,
};

export const spec = buildExerciseSpec({
  id: "wide-grip-behind-the-neck-cable-lat-pulldown",
  catalogId: "1a15c6f170d880d2918fc166e7a820d1",
  name: "Wide Grip Behind-The-Neck Cable Lat Pulldown",
  defaultLoadKg: 32,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Neck", "Return", "Reach"],
  tempo: { lower: 1.7, bottom: 0.3, raise: 1.9, top: 0.4 },
  station: {
    kind: "seated",
    seatY: 0.44,
    seatZ: -0.02,
    stanceX: 0.16,
    heelZ: 0.38,
    leanDeg: -4,
    frame: { type: "lat-pulldown", thighPadY: 0.64, pulleyZ: 0.08 },
    feetMode: "floor",
  },
  apparatus: {
    kind: "cable-single",
    skipColumn: true,
    pulley: [0, 2.18, 0.08],
    facingDir: -1,
    attachment: "lat-bar",
    attachmentWidth: 1.05,
    gripX: 0.44,
    handPath: { startY: 1.64, startZ: -0.02, endY: 1.28, endZ: -0.22 },
  },
  hints: { start: { ...SEAT, ...UP }, end: { ...SEAT, ...DOWN } },
  checks: () => [
    checkFlatBack(
      "Stay seated upright. Do not swing the torso to bring the bar behind the head.",
    ),
    checkJointRange(
      "elbow-pull",
      "Elbows bend behind the head",
      "Pull the bar down behind your head toward your upper back by driving your elbows down toward your sides as you progressively bend them.",
      "elbow_L.flex",
      55,
    ),
    checkJointWithinAt(
      "arms-y",
      "Arms start in a wide Y",
      "Grasp the bar well outside shoulder width, overhand, with straight elbows overhead.",
      "shoulder_L.elev",
      "top",
      125,
      175,
    ),
    checkJointWithinAt(
      "overhand",
      "Palms face forward",
      "Use a wide overhand grip so your palms are directed forward.",
      "forearm_L.pron",
      "top",
      45,
      100,
    ),
    checkJointWithinAt(
      "chin-tuck",
      "Chin nods toward the chest",
      "Nod your head to bring your chin closer toward your chest so your head does not block the bar.",
      "neck.flex",
      "bottom",
      8,
      28,
    ),
    checkJointWithinAt(
      "bar-behind",
      "Elbows finish flared behind the neck",
      "Drive the elbows down and out so the bar can travel behind the head toward the upper back.",
      "shoulder_L.plane",
      "bottom",
      -55,
      32,
    ),
    checkJointWithinAt(
      "scapulae-down",
      "Shoulder blades pull down",
      "Simultaneously pull your shoulder blades down away from your ears.",
      "clavicle_L.elev",
      "bottom",
      -20,
      4,
    ),
  ],
});
