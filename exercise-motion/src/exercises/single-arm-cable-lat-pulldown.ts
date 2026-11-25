import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Seated unilateral D-handle, elbow tucked, palm in. */
const ACTIVE_UP = {
  "shoulder.elev": 158,
  "shoulder.plane": 72,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 12,
  "clavicle.prot": 4,
};

const ACTIVE_DOWN = {
  "shoulder.elev": 34,
  "shoulder.plane": 22,
  "shoulder.twist": 4,
  "elbow.flex": 108,
  "forearm.pron": 0,
  "wrist.flex": 4,
  "clavicle.elev": -6,
  "clavicle.prot": -14,
};

const REST = {
  "shoulder.elev": 16,
  "shoulder.plane": 20,
  "elbow.flex": 18,
  "forearm.pron": 20,
  "clavicle.elev": 2,
  "clavicle.prot": 0,
};

const SEAT = {
  ...POSTURE_HINTS.seatedLeanBack,
  "root.pitch": -10,
  "hip.flex": 82,
  "knee.flex": 92,
  "lumbar.flex": 2,
  "thoracic.flex": -2,
  "neck.flex": -4,
};

export const spec = buildExerciseSpec({
  id: "single-arm-cable-lat-pulldown",
  catalogId: "1d55c6f170d88028a79af1239c96794e",
  name: "Single Arm Cable Lat Pulldown",
  defaultLoadKg: 6,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Pull", "Chest", "Return", "Reach"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.7, top: 0.35 },
  station: {
    kind: "seated",
    seatY: 0.44,
    seatZ: -0.02,
    stanceX: 0.16,
    heelZ: 0.34,
    leanDeg: -10,
    frame: { type: "lat-pulldown", thighPadY: 0.62, pulleyZ: 0.16 },
    feetMode: "floor",
  },
  apparatus: {
    kind: "cable-single",
    skipColumn: true,
    pulley: [0, 2.18, 0.16],
    facingDir: -1,
    attachment: "d-handle",
    sides: ["L"],
  },
  hints: {
    start: sidedHints("L", ACTIVE_UP, REST, SEAT),
    end: sidedHints("L", ACTIVE_DOWN, REST, SEAT),
  },
  checks: () => [
    checkFlatBack(
      "Keep the slight backward lean steady. Movement happens at the working shoulder, shoulder blade, and elbow.",
    ),
    checkNeutralNeck("Keep your trunk from twisting and your neck quiet."),
    checkJointRange(
      "elbow-pull",
      "Working elbow bends down and back",
      "Drive your elbow downward and then backward in an arc while bending it to pull the handle toward the side of your upper chest.",
      "elbow_L.flex",
      70,
    ),
    checkJointWithinAt(
      "arm-overhead",
      "Working arm starts overhead",
      "Grasp the handle with a straight elbow and your arm overhead, aligned with the cable.",
      "shoulder_L.elev",
      "top",
      125,
      175,
    ),
    checkJointWithinAt(
      "elbow-in",
      "Elbow finishes in front of the torso",
      "After the first half of the pull, the back of the elbow points forward with the upper arm in front of the body, not flared out.",
      "shoulder_L.plane",
      "bottom",
      8,
      50,
    ),
    checkJointWithinAt(
      "scapula-down",
      "Working shoulder blade pulls down",
      "Simultaneously pull your shoulder blade down away from your ear.",
      "clavicle_L.elev",
      "bottom",
      -20,
      4,
    ),
  ],
});
