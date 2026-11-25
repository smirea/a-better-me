import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { ALONG_Z, box, cylinder } from "../equipment";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Standing T-bar, no chest pad. Wide handles, elbows flare toward a T. */
const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.86,
  "root.z": 0.02,
  "root.pitch": 54,
  "hip.flex": 72,
  "hip.abd": 10,
  "knee.flex": 28,
  "ankle.dorsi": 8,
  "lumbar.flex": 4,
  "thoracic.flex": 6,
  "neck.flex": -4,
};

const HANG = {
  "shoulder.elev": 52,
  "shoulder.plane": 86,
  "shoulder.twist": 16,
  "elbow.flex": 8,
  "forearm.pron": 70,
  "wrist.flex": 6,
  "clavicle.elev": 6,
  "clavicle.prot": 6,
};

const ROW = {
  "shoulder.elev": 58,
  "shoulder.plane": 22,
  "shoulder.twist": 14,
  "elbow.flex": 104,
  "forearm.pron": 66,
  "wrist.flex": 4,
  "clavicle.elev": 10,
  "clavicle.prot": -16,
};

export const spec = buildExerciseSpec({
  id: "bent-over-wide-grip-t-bar-row",
  catalogId: "2ad5c6f170d880b297d2d3c9464652b7",
  name: "Bent-Over Wide Grip T-Bar Row",
  defaultLoadKg: 30,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "T", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.5, top: 0.35 },
  station: { kind: "standing", stanceX: 0.2, heelZ: -0.06, toeOutDeg: 10, torsoLeanDeg: 54, balanceZ: 0.02 },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    forceDir: [0, -1, 0.15],
  },
  extraEquipment: [
    box("tbar.rail", [0, 0.05, 0.55], [0.1, 0.08, 1.15], "steel", false),
    cylinder("tbar.sleeve", [0, 0.4, 0.98], 0.035, 0.42, "steel", ALONG_Z, false),
    cylinder("tbar.plate", [0, 0.4, 1.16], 0.18, 0.04, "plate", ALONG_Z, false),
  ],
  extraContacts: {
    handle_L: { upperarm_L: 0.1, chest: 0.12, thigh_L: 0.1, shank_L: 0.1, forearm_L: 0.08, pelvis: 0.08 },
    handle_R: { upperarm_R: 0.1, chest: 0.12, thigh_R: 0.1, shank_R: 0.1, forearm_R: 0.08, pelvis: 0.08 },
  },
  stiffness: { elbow: 2.2, shoulder: 1.1, lumbar: 8, hip: 3 },
  hints: { start: { ...HINGE, ...HANG }, end: { ...HINGE, ...ROW } },
  checks: () => [
    checkFlatBack(
      "Keep your torso in a fixed hinged position, closer to horizontal than vertical, with your lower back near neutral and your core braced.",
    ),
    checkNeutralNeck("Keep your chest up and your neck near neutral rather than rounding your back."),
    checkJointRange(
      "wide-tbar",
      "Elbows drive up and out",
      "Pull the bar upward and back by driving your elbows simultaneously upward and backward while bending them.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "arms-long",
      "Elbows start straight",
      "Lift the bar just high enough that you feel the weight with your elbows fully straight.",
      "elbow_L.flex",
      "top",
      0,
      28,
    ),
    checkJointWithinAt(
      "wide",
      "Wide grip, palms angled back",
      "Grasp the outer handles with a wide grip, hands clearly outside shoulder width and palms angled backward.",
      "forearm_L.pron",
      "start",
      40,
      90,
    ),
    checkJointWithinAt(
      "elbows-out",
      "Elbows flare toward a T",
      "Allow your elbows to flare out so your upper arms finish closer to a T-shape than tucked by your sides.",
      "shoulder_L.plane",
      "bottom",
      0,
      48,
    ),
    checkJointWithinAt(
      "scapulae",
      "Shoulder blades pinch",
      "Squeeze your shoulder blades together at the top of the pull as if pinching a pencil between them.",
      "clavicle_L.prot",
      "peak",
      -40,
      -4,
    ),
  ],
});
