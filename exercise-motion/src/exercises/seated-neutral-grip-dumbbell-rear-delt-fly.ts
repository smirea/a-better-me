import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Same seated hinge, palms facing in. */
const TRUNK = {
  "root.y": 0.58,
  "root.z": -0.02,
  "root.pitch": 18,
  "hip.flex": 112,
  "hip.abd": 12,
  "knee.flex": 78,
  "ankle.dorsi": 4,
  "lumbar.flex": 8,
  "thoracic.flex": 16,
  "neck.flex": -8,
};

const HANG = {
  "shoulder.elev": 58,
  "shoulder.plane": 74,
  "shoulder.twist": 4,
  "elbow.flex": 16,
  "forearm.pron": 6,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": 4,
};

const T = {
  ...HANG,
  "shoulder.elev": 96,
  "shoulder.plane": 4,
  "elbow.flex": 18,
  "clavicle.elev": 12,
  "clavicle.prot": -14,
};

export const spec = buildExerciseSpec({
  id: "seated-neutral-grip-dumbbell-rear-delt-fly",
  catalogId: "1a15c6f170d88010a5b5f71c3ef7890d",
  name: "Seated Neutral Grip Dumbbell Rear Delt Fly",
  defaultLoadKg: 6,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Raise", "T", "Lower", "Hang"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.4, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.46,
    seatZ: 0,
    stanceX: 0.2,
    heelZ: 0.42,
    pinBack: false,
    passiveJoints: ["knee", "ankle"],
    frame: { type: "flat-bench", zHead: -0.2, zFoot: 0.28 },
  },
  apparatus: { kind: "dumbbells" },
  stiffness: { elbow: 5, shoulder: 0.65, lumbar: 8, thoracic: 6, hip: 4 },
  hints: {
    start: { ...TRUNK, ...HANG },
    end: { ...TRUNK, ...T },
  },
  checks: () => [
    checkFlatBack("Stay bent over. The hips and the torso do not rise as the bells move."),
    checkJointWithinAt(
      "neutral-grip",
      "Neutral grip",
      "Hold the dumbbells with the palms facing in toward the sides.",
      "forearm_L.pron",
      "start",
      -25,
      32,
    ),
    checkJointWithinAt(
      "soft-elbows",
      "Elbows stay slightly bent",
      "Keep a slight bend in the elbows while the arms hang in front of the knees.",
      "elbow_L.flex",
      "peak",
      6,
      36,
    ),
    checkJointWithinAt(
      "t-shape",
      "Arms finish in a T",
      "Raise the dumbbells straight out to the sides until the arms and torso form a T.",
      "shoulder_L.plane",
      "peak",
      -16,
      24,
    ),
    checkJointRange(
      "rear-fly",
      "Bells travel from a hang out to the sides",
      "Lower the dumbbells back in front of the knees under control.",
      "shoulder_L.plane",
      40,
    ),
  ],
});
