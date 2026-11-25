import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Seated diverging row with no chest pad. Upright torso, palms angled in, elbows free to open. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.56,
  "root.z": -0.02,
  "root.pitch": 4,
  "hip.flex": 88,
  "knee.flex": 78,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
};

const GRIP = {
  "shoulder.twist": 6,
  "forearm.pron": 28,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "diverging-pin-loaded-machine-row-without-chest-support",
  catalogId: "3105c6f170d88055baf3fec9b346318c",
  name: "Diverging Pin-Loaded Machine Row (Without Chest Support)",
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
    leanDeg: 4,
    feetMode: "floor",
    pinBack: true,
    frame: { type: "machine", backAngleDeg: 82, stackZ: -0.62 },
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
      push(34 * (anchorPoint(body, frame, "grip_L").x - 0.26));
      push(34 * (anchorPoint(body, frame, "grip_R").x + 0.26));
    },
  ],
  hints: {
    start: {
      ...SEAT,
      ...GRIP,
      "shoulder.elev": 76,
      "shoulder.plane": 64,
      "elbow.flex": 10,
      "clavicle.prot": 10,
      "clavicle.elev": 4,
    },
    end: {
      ...SEAT,
      ...GRIP,
      "shoulder.elev": 42,
      "shoulder.plane": 30,
      "elbow.flex": 102,
      "clavicle.prot": -16,
      "clavicle.elev": 6,
    },
  },
  checks: () => [
    checkFlatBack("Your knees, hips, and lower back should remain nearly stationary in a stable position throughout the set as you keep your torso upright."),
    checkNeutralNeck("Keep your neck quiet and your torso steady against the pad."),
    checkJointRange(
      "row",
      "Elbows drive through the row",
      "Pull the handles back toward you by driving your elbows backward while pulling your shoulder blades together into a proud chest posture.",
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
      "Palms angled inward",
      "Sit upright with your arms aligned with the cables and your palms angled in toward each other.",
      "forearm_L.pron",
      "start",
      5,
      55,
    ),
    checkJointWithinAt(
      "elbow-path",
      "Elbow path",
      "Let your elbows move through a path that feels comfortable, whether tucked fairly close to your sides or moderately flared.",
      "shoulder_L.plane",
      "peak",
      8,
      55,
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
