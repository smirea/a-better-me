import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Plate-loaded D.Y. row. Chest on the pad, palms angled up, elbows tucked, pull back toward the hips. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.56,
  "root.z": -0.02,
  "root.pitch": 10,
  "hip.flex": 78,
  "knee.flex": 78,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
};

const GRIP = {
  "shoulder.twist": -10,
  "forearm.pron": -68,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "machine-d-y-row",
  catalogId: "33c5c6f170d8800c96aff8711b3ab9a8",
  name: "Machine D.Y. Row",
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
    leanDeg: 10,
    feetMode: "floor",
    pinBack: false,
    frame: { type: "machine", chestPadZ: 0.4, chestPadY: 1.06, stackZ: -0.62 },
  },
  stiffness: { lumbar: 12, thoracic: 10, hip: 6, knee: 4, shoulder: 0.7 },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    anchor: "grip",
    forceDir: [0, -0.15, 1],
  },
  extraContacts: {
    handle_L: { chest: 0.05, upperarm_L: 0.05, thigh_L: 0.04, girdle: 0.06 },
    handle_R: { chest: 0.05, upperarm_R: 0.05, thigh_R: 0.04, girdle: 0.06 },
  },
  extraGoals: (body) => [
    ({ frame, push }) => {
      push(34 * (anchorPoint(body, frame, "grip_L").x - 0.18));
      push(34 * (anchorPoint(body, frame, "grip_R").x + 0.18));
    },
  ],
  hints: {
    start: {
      ...SEAT,
      ...GRIP,
      "shoulder.elev": 68,
      "shoulder.plane": 70,
      "elbow.flex": 10,
      "clavicle.prot": 10,
      "clavicle.elev": 4,
    },
    end: {
      ...SEAT,
      ...GRIP,
      "shoulder.elev": 30,
      "shoulder.plane": 60,
      "elbow.flex": 108,
      "clavicle.prot": -16,
      "clavicle.elev": 4,
    },
  },
  checks: () => [
    checkFlatBack("Keep your chest in contact with the chest pad throughout the set."),
    checkNeutralNeck("Keep your neck quiet and your torso steady against the pad."),
    checkJointRange(
      "row",
      "Elbows drive through the row",
      "Pull the handles back toward the sides of your torso by driving your elbows backward while simultaneously pulling your shoulder blades together.",
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
      "Palms angled upward",
      "Reach fully forward and firmly grasp the handles with straight elbows and your palms angled upward.",
      "forearm_L.pron",
      "start",
      -100,
      -35,
    ),
    checkJointWithinAt(
      "elbow-path",
      "Elbow path",
      "Keep them tucked fairly close to your sides with this machine rather than notably flaring your elbows away from your sides.",
      "shoulder_L.plane",
      "peak",
      42,
      80,
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
