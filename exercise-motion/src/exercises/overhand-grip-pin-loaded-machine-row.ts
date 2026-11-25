import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Seated chest-supported selectorized row. Horizontal handles, elbows flare. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.56,
  "root.z": -0.02,
  "root.pitch": 12,
  "hip.flex": 78,
  "knee.flex": 78,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
};

const GRIP = {
  "shoulder.twist": 14,
  "forearm.pron": 72,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "overhand-grip-pin-loaded-machine-row",
  catalogId: "1a15c6f170d880409004f87e18f9b974",
  name: "Overhand Grip Pin-Loaded Machine Row",
  defaultLoadKg: 40,
  loadUnit: "total",
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
    leanDeg: 12,
    feetMode: "floor",
    pinBack: false,
    frame: { type: "machine", chestPadZ: 0.4, chestPadY: 1.06, stackZ: -0.62 },
  },
  stiffness: { lumbar: 12, thoracic: 10, hip: 6, knee: 4, shoulder: 0.7 },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    anchor: "grip",
    forceDir: [0, 0, 1],
  },
  extraContacts: {
    handle_L: { chest: 0.05, upperarm_L: 0.05, thigh_L: 0.04, girdle: 0.06 },
    handle_R: { chest: 0.05, upperarm_R: 0.05, thigh_R: 0.04, girdle: 0.06 },
  },
  extraGoals: (body) => [
    ({ frame, push }) => {
      push(34 * (anchorPoint(body, frame, "grip_L").x - 0.34));
      push(34 * (anchorPoint(body, frame, "grip_R").x + 0.34));
    },
  ],
  hints: {
    start: {
      ...SEAT,
      ...GRIP,
      "shoulder.elev": 74,
      "shoulder.plane": 62,
      "elbow.flex": 10,
      "clavicle.prot": 10,
      "clavicle.elev": 4,
    },
    end: {
      ...SEAT,
      ...GRIP,
      "shoulder.elev": 46,
      "shoulder.plane": 32,
      "elbow.flex": 100,
      "clavicle.prot": -16,
      "clavicle.elev": 8,
    },
  },
  checks: () => [
    checkFlatBack("Keep your chest in contact with the chest pad throughout the set."),
    checkNeutralNeck("Keep your neck quiet and your torso steady against the pad."),
    checkJointRange(
      "row",
      "Elbows drive through the row",
      "Pull the handles back toward you by driving your elbows backward while simultaneously bending them and pulling your shoulder blades together.",
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
      "Overhand grip",
      "Grasp the horizontally directed handles firmly with your palms facing down (i.e., an overhand grip).",
      "forearm_L.pron",
      "start",
      45,
      95,
    ),
    checkJointWithinAt(
      "elbow-path",
      "Elbow path",
      "Allow your elbows naturally to flare out away from your sides in a manner that feels comfortable to you.",
      "shoulder_L.plane",
      "peak",
      10,
      50,
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
