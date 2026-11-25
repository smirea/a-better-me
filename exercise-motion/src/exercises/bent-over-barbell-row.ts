import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Slightly outside shoulder width, overhand, elbows free to flare. */
const GRIP = {
  "shoulder.plane": 72,
  "shoulder.twist": 18,
  "forearm.pron": 75,
  "wrist.flex": 8,
  "wrist.dev": 2,
};

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.86,
  "root.z": -0.1,
  "root.pitch": 60,
  "hip.flex": 78,
  "hip.abd": 6,
  "knee.flex": 22,
  "ankle.dorsi": 8,
  "lumbar.flex": 6,
  "thoracic.flex": 8,
  "neck.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "bent-over-barbell-row",
  catalogId: "1a15c6f170d880f89beacd8c81156f2d",
  name: "Bent-Over Barbell Row",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Upper abdomen", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.5, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 8, torsoLeanDeg: 60 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.3,
    path: { startY: 0.46, startZ: 0.22, endY: 0.86, endZ: 0.14 },
  },
  hints: {
    start: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 52,
      "elbow.flex": 8,
      "clavicle.prot": -2,
      "clavicle.elev": 6,
    },
    end: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 36,
      "shoulder.plane": 38,
      "elbow.flex": 112,
      "clavicle.prot": -16,
      "clavicle.elev": 10,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your torso in a fixed hinged position with your lower back near a neutral position and your core braced.",
    ),
    checkNeutralNeck(
      "Keep your neck near a neutral position, as when you are looking straight ahead while standing upright.",
    ),
    checkJointRange(
      "elbow-row",
      "Elbows bend as the bar rises",
      "Pull the bar up toward your upper abdomen by driving your elbows simultaneously backward and upward while progressively bending your elbows.",
      "elbow_L.flex",
      70,
    ),
    checkJointWithinAt(
      "arms-hang",
      "Arms hang toward the floor",
      "Lower the bar until your arms are directed down toward the ground with extended elbows. The plates should not touch the ground.",
      "elbow_L.flex",
      "start",
      0,
      28,
    ),
    checkJointWithinAt(
      "elbows-back",
      "Elbows finish behind the torso",
      "Row the bar until it is close to your upper abdomen, with your elbows behind your torso or at least aligned with it.",
      "elbow_L.flex",
      "peak",
      90,
      140,
    ),
    checkJointWithinAt(
      "scapulae-together",
      "Shoulder blades pull together",
      "Pull your shoulder blades together as you drive the elbows up.",
      "clavicle_L.prot",
      "peak",
      -28,
      -4,
    ),
  ],
});
