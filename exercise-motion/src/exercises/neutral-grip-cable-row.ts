import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Close V-bar: palms face each other and elbows stay near the ribs. */
const GRIP = {
  "shoulder.twist": 2,
  "forearm.pron": 0,
  "wrist.flex": 2,
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
  id: "neutral-grip-cable-row",
  catalogId: "1a15c6f170d88048b1ccfe9a74551d08",
  name: "Neutral Grip Cable Row",
  defaultLoadKg: 22,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Stomach", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.7, top: 0.35 },
  station: {
    kind: "seated",
    seatZ: -0.02,
    heelZ: 0.42,
    frame: { type: "seated-row", pulleyY: 0.68 },
    feetMode: "floor",
    leanDeg: 4,
  },
  apparatus: {
    kind: "cable-single",
    skipColumn: true,
    pulley: [0, 0.68, 1.25],
    facingDir: -1,
    attachment: "v-bar",
    gripX: 0.08,
  },
  hints: {
    start: {
      ...SEAT,
      ...GRIP,
      "shoulder.elev": 80,
      "shoulder.plane": 64,
      "elbow.flex": 6,
      "clavicle.prot": 6,
      "clavicle.elev": 4,
    },
    end: {
      ...SEAT,
      ...GRIP,
      "shoulder.elev": 34,
      "shoulder.plane": 48,
      "elbow.flex": 112,
      "clavicle.prot": -16,
      "clavicle.elev": 4,
    },
  },
  checks: () => [
    checkFlatBack(
      "Movement should occur at your shoulders, shoulder blades, and elbows, but your knees, hips, and lower back should remain nearly stationary.",
    ),
    checkNeutralNeck("Sit tall and keep your neck quiet through the row."),
    checkJointRange(
      "elbow-row",
      "Elbows bend on the close-grip row",
      "Pull the handles back toward your torso by driving your elbows backward while simultaneously bending them.",
      "elbow_L.flex",
      45,
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms start straight",
      "Grasp the handles firmly with straight elbows and your palms facing each other.",
      "elbow_L.flex",
      "top",
      0,
      40,
    ),
    checkJointWithinAt(
      "elbows-in",
      "Elbows stay tucked",
      "Keep your elbows tucked fairly close to your sides with this neutral grip, rather than flaring them.",
      "shoulder_L.plane",
      "bottom",
      10,
      80,
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
