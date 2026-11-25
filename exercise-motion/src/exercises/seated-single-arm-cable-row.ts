import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const ACTIVE_REACH = {
  "shoulder.elev": 84,
  "shoulder.plane": 78,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": 8,
};

const ACTIVE_PULL = {
  "shoulder.elev": 36,
  "shoulder.plane": 22,
  "shoulder.twist": 2,
  "elbow.flex": 112,
  "forearm.pron": 0,
  "wrist.flex": 4,
  "clavicle.elev": 2,
  "clavicle.prot": -16,
};

const REST = {
  "shoulder.elev": 18,
  "shoulder.plane": 20,
  "elbow.flex": 18,
  "forearm.pron": 10,
  "clavicle.elev": 2,
  "clavicle.prot": 0,
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
  id: "seated-single-arm-cable-row",
  catalogId: "1a15c6f170d88023adc2c02536b492c7",
  name: "Seated Single Arm Cable Row",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Pull", "Hip", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
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
    attachment: "d-handle",
    sides: ["L"],
  },
  hints: {
    start: sidedHints("L", ACTIVE_REACH, REST, SEAT),
    end: sidedHints("L", ACTIVE_PULL, REST, SEAT),
  },
  checks: () => [
    checkFlatBack(
      "Movement should occur at your shoulder, shoulder blade, and elbow, but your knees, hips, and lower back should remain nearly stationary.",
    ),
    checkNeutralNeck("Keep your torso upright and facing the cable without rotating."),
    checkJointRange(
      "elbow-row",
      "Elbow bends through the single-arm row",
      "Pull the handle back toward your torso by driving your elbow backward while simultaneously bending it.",
      "elbow_L.flex",
      70,
    ),
    checkJointWithinAt(
      "arm-long",
      "Working arm starts outstretched",
      "Grasp the handle firmly with an extended elbow, then sit upright before you row.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "elbow-back",
      "Elbow finishes beside the torso",
      "Keep the elbow tucked close to your side, level with your torso or slightly behind it.",
      "elbow_L.flex",
      "bottom",
      90,
      135,
    ),
    checkJointWithinAt(
      "scapula-back",
      "Shoulder blade pulls backward",
      "Pull your shoulder blade backward as the elbow drives back.",
      "clavicle_L.prot",
      "bottom",
      -28,
      -6,
    ),
  ],
});
