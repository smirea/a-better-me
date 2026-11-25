import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Chest-supported high-to-low row. Arms start raised in line with the resistance and drive down and back. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.56,
  "root.z": -0.02,
  "root.pitch": 8,
  "hip.flex": 78,
  "knee.flex": 78,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
};

const GRIP = {
  "shoulder.twist": 8,
  "forearm.pron": 48,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "pin-loaded-machine-high-row",
  catalogId: "30f5c6f170d88010a9c0dc8c3f5f33c4",
  name: "Pin-Loaded Machine High Row",
  defaultLoadKg: 15,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Squeeze", "Return", "Reach"],
  tempo: { lower: 1.3, bottom: 0.3, raise: 1.5, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.48,
    seatZ: -0.02,
    stanceX: 0.16,
    heelZ: 0.38,
    leanDeg: 8,
    feetMode: "floor",
    pinBack: false,
    frame: { type: "machine", chestPadZ: 0.4, chestPadY: 1.06, stackZ: -0.62 },
  },
  stiffness: { lumbar: 12, thoracic: 10, hip: 6, knee: 4, shoulder: 0.7 },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    anchor: "grip",
    forceDir: [0, 0.75, 0.45],
  },
  extraContacts: {
    handle_L: { chest: 0.05, upperarm_L: 0.05, thigh_L: 0.04, girdle: 0.06 },
    handle_R: { chest: 0.05, upperarm_R: 0.05, thigh_R: 0.04, girdle: 0.06 },
  },
  extraGoals: (body) => [
    ({ frame, push }) => {
      push(34 * (anchorPoint(body, frame, "grip_L").x - 0.28));
      push(34 * (anchorPoint(body, frame, "grip_R").x + 0.28));
    },
  ],
  hints: {
    start: {
      ...SEAT,
      ...GRIP,
      "shoulder.elev": 112,
      "shoulder.plane": 40,
      "elbow.flex": 10,
      "clavicle.prot": 10,
      "clavicle.elev": 20,
    },
    end: {
      ...SEAT,
      ...GRIP,
      "shoulder.elev": 48,
      "shoulder.plane": 36,
      "elbow.flex": 100,
      "clavicle.prot": -16,
      "clavicle.elev": 2,
    },
  },
  checks: () => [
    checkFlatBack("Keep your torso upright against the chest pad throughout your set rather than leaning backward during the row."),
    checkNeutralNeck("Keep your neck quiet and your torso steady against the pad."),
    checkJointRange(
      "row",
      "Elbows drive through the row",
      "Drive your elbows down and back to pull the handles toward you, and finish with your elbows slightly behind your torso.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "arms-long",
      "Elbows start straight",
      "Reach fully forward with straight elbows before you pull.",
      "elbow_L.flex",
      "start",
      0,
      32,
    ),
    checkJointWithinAt(
      "grip",
      "Comfortable machine grip",
      "Firmly grasp the handles with a grip that feels comfortable to you based on the design of your machine.",
      "forearm_L.pron",
      "start",
      20,
      75,
    ),
    checkJointWithinAt(
      "elbow-path",
      "Elbow path",
      "While pulling your shoulder blades down and back, drive your elbows down and back to pull the handles toward you.",
      "shoulder_L.plane",
      "peak",
      15,
      60,
    ),
    checkJointWithinAt(
      "scapulae",
      "Shoulder blades pinch",
      "Squeeze your shoulder blades together at the end of the pull as if you were trying to pinch a pencil with your shoulder blades.",
      "clavicle_L.prot",
      "peak",
      -32,
      -2,
    ),
  ],
});
