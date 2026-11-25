import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Upright on a chest-supported selectorized row. Parallel handles, elbows tucked. */
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
  "shoulder.twist": 0,
  "forearm.pron": 0,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "neutral-grip-pin-loaded-machine-row",
  catalogId: "1a15c6f170d8807188c0da98a91c30c3",
  name: "Neutral Grip Pin-Loaded Machine Row",
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
  stiffness: { lumbar: 12, thoracic: 10, hip: 6, knee: 4, shoulder: 0.65 },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    anchor: "grip",
    forceDir: [0, 0, 1],
  },
  extraContacts: {
    handle_L: { chest: 0.05, upperarm_L: 0.05, thigh_L: 0.04, girdle: 0.06 },
    handle_R: { chest: 0.05, upperarm_R: 0.05, thigh_R: 0.04, girdle: 0.06 },
  },
  extraGoals: (body) => [
    ({ frame, push }) => {
      push(34 * (anchorPoint(body, frame, "grip_L").x - 0.17));
      push(34 * (anchorPoint(body, frame, "grip_R").x + 0.17));
    },
  ],
  hints: {
    start: {
      ...SEAT,
      ...GRIP,
      "shoulder.elev": 78,
      "shoulder.plane": 66,
      "elbow.flex": 10,
      "clavicle.prot": 10,
      "clavicle.elev": 4,
    },
    end: {
      ...SEAT,
      ...GRIP,
      "shoulder.elev": 40,
      "shoulder.plane": 58,
      "elbow.flex": 105,
      "clavicle.prot": -16,
      "clavicle.elev": 6,
    },
  },
  checks: () => [
    checkFlatBack("Keep your chest in contact with the chest pad throughout the set."),
    checkNeutralNeck("Stay against the pad with your neck quiet."),
    checkJointRange(
      "row",
      "Elbows drive back",
      "Pull the handles back toward the sides of your torso by driving your elbows backward while simultaneously bending them.",
      "elbow_L.flex",
      65,
    ),
    checkJointWithinAt(
      "arms-long",
      "Elbows start straight",
      "Reach fully forward with extended elbows to grasp the parallel handles.",
      "elbow_L.flex",
      "start",
      0,
      24,
    ),
    checkJointWithinAt(
      "neutral",
      "Neutral grip",
      "Grasp the parallel handles firmly with your palms facing in toward each other (i.e., a neutral grip).",
      "forearm_L.pron",
      "start",
      -25,
      25,
    ),
    checkJointWithinAt(
      "tucked",
      "Elbows stay tucked",
      "Keep them tucked close to your sides with this grip rather than notably flaring your elbows away from your sides.",
      "shoulder_L.plane",
      "peak",
      45,
      75,
    ),
    checkJointWithinAt(
      "scapulae",
      "Shoulder blades pinch",
      "Squeeze your shoulder blades together at the end of the pull as if you were trying to pinch a pencil with your shoulder blades.",
      "clavicle_L.prot",
      "peak",
      -30,
      -4,
    ),
  ],
});
