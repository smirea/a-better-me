import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * Hip-hinged row between two low cables. `cable-dual` only builds D-handles,
 * so each hand holds a handle at bar-grip width instead of one shared shaft.
 */
const GRIP = {
  "shoulder.twist": 16,
  "forearm.pron": 72,
  "wrist.flex": 6,
};

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.82,
  "root.z": -0.16,
  "root.pitch": 68,
  "hip.flex": 78,
  "hip.abd": 6,
  "knee.flex": 22,
  "ankle.dorsi": 8,
  "lumbar.flex": 6,
  "thoracic.flex": 8,
  "neck.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "bent-over-dual-cable-bar-row",
  catalogId: "3965c6f170d880b78741dbf085ed2103",
  name: "Bent-Over Dual Cable Bar Row",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Abdomen", "Lower", "Hang"],
  tempo: { lower: 1.3, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: { kind: "standing", stanceX: 0.18, heelZ: -0.02, toeOutDeg: 8, torsoLeanDeg: 66 },
  stiffness: { knee: 6, hip: 4, lumbar: 5 },
  apparatus: {
    kind: "cable-dual",
    pulleyY: 0.28,
    halfWidth: 0.7,
    z: 0.42,
    attachment: "d-handle",
  },
  hints: {
    start: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 58,
      "shoulder.plane": 74,
      "elbow.flex": 8,
      "clavicle.prot": 2,
      "clavicle.elev": 6,
    },
    end: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 40,
      "shoulder.plane": 40,
      "elbow.flex": 112,
      "clavicle.prot": -16,
      "clavicle.elev": 10,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your torso in a fixed hinged position with your lower back near neutral and your core braced.",
    ),
    checkNeutralNeck(
      "Keep your neck near neutral, as when you are looking straight ahead while standing upright.",
    ),
    checkJointRange(
      "elbow-row",
      "Elbows bend as the hands rise",
      "Pull toward your upper abdomen by driving your elbows backward and upward while bending them.",
      "elbow_L.flex",
      70,
    ),
    checkJointWithinAt(
      "arms-hang",
      "Arms hang toward the floor",
      "Lower until your arms point down toward the ground with straight elbows.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "elbows-back",
      "Elbows finish behind the torso",
      "Row until the hands are near your upper abdomen and your elbows are behind your torso.",
      "elbow_L.flex",
      "bottom",
      90,
      140,
    ),
    checkJointWithinAt(
      "scapulae-together",
      "Shoulder blades pull together",
      "Pull your shoulder blades together as the elbows drive up, and let them flare about 45 degrees.",
      "clavicle_L.prot",
      "bottom",
      -28,
      -4,
    ),
  ],
});
