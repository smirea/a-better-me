import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { box, quatOf } from "../equipment";
import { rad } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Inclined chest-supported T-bar. Angled handles, about 40 degrees of pronation, elbows near 45 degrees. */
const TRUNK = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.72,
  "root.z": -0.02,
  "root.pitch": 22,
  "hip.flex": 72,
  "hip.abd": 12,
  "knee.flex": 70,
  "ankle.dorsi": 8,
  "lumbar.flex": 6,
  "thoracic.flex": 4,
  "neck.flex": -4,
};

const PAD_Q = quatOf([1, 0, 0], rad(24));

const GRIP = {
  "shoulder.twist": 8,
  "forearm.pron": 40,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "chest-supported-semi-neutral-grip-t-bar-row",
  catalogId: "1a15c6f170d8803bb4dbc83c2279dbcf",
  name: "Chest-Supported Semi-Neutral Grip T-Bar Row",
  defaultLoadKg: 30,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Squeeze", "Lower", "Reach"],
  tempo: { lower: 1.3, bottom: 0.3, raise: 1.5, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.52,
    seatZ: 0,
    stanceX: 0.22,
    heelZ: 0.48,
    leanDeg: 22,
    feetMode: "floor",
    pinBack: false,
    frame: { type: "flat-bench", zHead: -0.35, zFoot: 0.28 },
  },
  stiffness: { lumbar: 14, thoracic: 12, hip: 8, knee: 6, shoulder: 0.7 },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    anchor: "grip",
    forceDir: [0, -0.25, 1],
  },
  extraEquipment: [
    box("tbar.chestPad", [0, 1.02, 0.2], [0.3, 0.07, 0.46], "pad", false, PAD_Q),
    box("tbar.padPost", [0, 0.62, 0.22], [0.06, 0.72, 0.06], "steel", false),
    box("tbar.sleeve", [0, 0.72, 0.78], [0.04, 0.04, 0.36], "chrome", false),
    box("tbar.plates", [0, 0.72, 0.9], [0.28, 0.28, 0.08], "plate", false),
    box("tbar.footL", [0.18, 0.16, 0.7], [0.16, 0.04, 0.28], "steel", false, quatOf([1, 0, 0], rad(-20))),
    box("tbar.footR", [-0.18, 0.16, 0.7], [0.16, 0.04, 0.28], "steel", false, quatOf([1, 0, 0], rad(-20))),
  ],
  extraContacts: {
    handle_L: { thigh_L: 0.06, pelvis: 0.05, chest: 0.05, upperarm_L: 0.05, girdle: 0.05 },
    handle_R: { thigh_R: 0.06, pelvis: 0.05, chest: 0.05, upperarm_R: 0.05, girdle: 0.05 },
  },
  extraGoals: (body) => [
    ({ frame, push }) => {
      const left = anchorPoint(body, frame, "grip_L");
      const right = anchorPoint(body, frame, "grip_R");
      push(36 * (left.x - 0.26));
      push(36 * (right.x + 0.26));
      push(18 * (left.y - right.y));
      push(12 * (left.z - right.z));
    },
  ],
  hints: {
    start: {
      ...TRUNK,
      ...GRIP,
      "shoulder.elev": 70,
      "shoulder.plane": 64,
      "elbow.flex": 12,
      "clavicle.prot": 8,
      "clavicle.elev": 4,
    },
    end: {
      ...TRUNK,
      ...GRIP,
      "shoulder.elev": 42,
      "shoulder.plane": 42,
      "elbow.flex": 100,
      "clavicle.prot": -16,
      "clavicle.elev": 8,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your torso in contact with the chest pad throughout the set rather than arching your lower back to lift your chest up off the pad.",
    ),
    checkNeutralNeck("Keep your chest on the pad and your neck quiet while you look along the sleeve."),
    checkJointRange(
      "t-bar-row",
      "Elbows drive up and back",
      "Pull the bar upward and back toward your torso by driving your elbows simultaneously upward and backward.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "arms-long",
      "Elbows start extended",
      "Lower the bar until your elbows are extended and the weight pulls your shoulder blades apart.",
      "elbow_L.flex",
      "start",
      0,
      32,
    ),
    checkJointWithinAt(
      "grip",
      "Semi-neutral grip",
      "Grasp the inner handles that are angled outward and backward such that your palms are facing at an angle in toward each other and backward.",
      "forearm_L.pron",
      "start",
      18,
      62,
    ),
    checkJointWithinAt(
      "elbow-path",
      "Elbow path",
      "Flare them out moderately away from your sides, such that your upper arms form close to 45-degree angles with your torso toward the end of the lifting phase.",
      "shoulder_L.plane",
      "peak",
      22,
      62,
    ),
    checkJointWithinAt(
      "scapulae",
      "Shoulder blades pinch",
      "Squeeze your shoulder blades together at the top of the pull as if you were trying to pinch a pencil with your shoulder blades.",
      "clavicle_L.prot",
      "peak",
      -32,
      -4,
    ),
  ],
});
