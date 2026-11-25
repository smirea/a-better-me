import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { ALONG_Z, box, cylinder } from "../equipment";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Standing T-bar, no chest pad. Close underhand handles, elbows tucked. */
const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.86,
  "root.z": 0.02,
  "root.pitch": 54,
  "hip.flex": 72,
  "hip.abd": 8,
  "knee.flex": 28,
  "ankle.dorsi": 8,
  "lumbar.flex": 4,
  "thoracic.flex": 6,
  "neck.flex": -4,
};

const HANG = {
  "shoulder.elev": 42,
  "shoulder.plane": 58,
  "shoulder.twist": -10,
  "elbow.flex": 8,
  "forearm.pron": -72,
  "wrist.flex": 6,
  "clavicle.elev": 4,
  "clavicle.prot": 4,
};

const ROW = {
  "shoulder.elev": 30,
  "shoulder.plane": 32,
  "shoulder.twist": -8,
  "elbow.flex": 112,
  "forearm.pron": -70,
  "wrist.flex": 4,
  "clavicle.elev": 8,
  "clavicle.prot": -16,
};

export const spec = buildExerciseSpec({
  id: "bent-over-underhand-grip-t-bar-row",
  catalogId: "1d05c6f170d880d0a3ceff8d48eb959c",
  name: "Bent-Over Underhand Grip T-Bar Row",
  defaultLoadKg: 30,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Torso", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.5, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, heelZ: -0.06, toeOutDeg: 8, torsoLeanDeg: 54, balanceZ: 0.02 },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    forceDir: [0, -1, 0.15],
  },
  extraEquipment: [
    box("tbar.rail", [0, 0.05, 0.55], [0.1, 0.08, 1.15], "steel", false),
    cylinder("tbar.sleeve", [0, 0.42, 0.95], 0.035, 0.42, "steel", ALONG_Z, false),
    cylinder("tbar.plate", [0, 0.42, 1.12], 0.18, 0.04, "plate", ALONG_Z, false),
  ],
  extraContacts: {
    handle_L: { upperarm_L: 0.1, chest: 0.12, thigh_L: 0.1, shank_L: 0.1, forearm_L: 0.08, pelvis: 0.08 },
    handle_R: { upperarm_R: 0.1, chest: 0.12, thigh_R: 0.1, shank_R: 0.1, forearm_R: 0.08, pelvis: 0.08 },
  },
  stiffness: { elbow: 2.2, shoulder: 1.1, lumbar: 8, hip: 3 },
  hints: { start: { ...HINGE, ...HANG }, end: { ...HINGE, ...ROW } },
  checks: () => [
    checkFlatBack(
      "Keep your torso in a fixed hinged position, closer to horizontal than vertical, with your lower back flat and your core braced.",
    ),
    checkNeutralNeck("Keep your chest up and your lower back near neutral rather than rounding your back."),
    checkJointRange(
      "underhand-tbar",
      "Elbows drive up and back",
      "Pull the bar toward your torso by driving your elbows simultaneously upward and backward while progressively bending them.",
      "elbow_L.flex",
      65,
    ),
    checkJointWithinAt(
      "arms-long",
      "Elbows start straight",
      "Lift the bar just high enough that you can experience resistance when your elbows are fully straight.",
      "elbow_L.flex",
      "top",
      0,
      28,
    ),
    checkJointWithinAt(
      "underhand",
      "Underhand grip",
      "Grasp the handles with a near shoulder-width underhand grip, such that your palms face forward.",
      "forearm_L.pron",
      "start",
      -90,
      -40,
    ),
    checkJointWithinAt(
      "elbows-tucked",
      "Elbows stay tucked",
      "Keep your elbows tucked fairly close to your sides with this underhand grip rather than notably flaring them.",
      "shoulder_L.plane",
      "bottom",
      12,
      52,
    ),
    checkJointWithinAt(
      "scapulae",
      "Shoulder blades pinch",
      "Squeeze your shoulder blades together at the top of the pull as if you were trying to pinch a pencil with them.",
      "clavicle_L.prot",
      "peak",
      -40,
      -4,
    ),
  ],
});
