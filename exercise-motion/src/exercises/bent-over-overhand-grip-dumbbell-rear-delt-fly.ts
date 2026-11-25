import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.86,
  "root.z": -0.06,
  "root.pitch": 70,
  "hip.flex": 86,
  "hip.abd": 8,
  "knee.flex": 22,
  "ankle.dorsi": 8,
  "lumbar.flex": 6,
  "thoracic.flex": 8,
  "neck.flex": -8,
};

const HANG = {
  "shoulder.elev": 56,
  "shoulder.plane": 76,
  "shoulder.twist": 14,
  "elbow.flex": 16,
  "forearm.pron": 76,
  "wrist.flex": 2,
  "clavicle.elev": 4,
  "clavicle.prot": 4,
};

const T = {
  ...HANG,
  "shoulder.elev": 98,
  "shoulder.plane": 2,
  "elbow.flex": 18,
  "clavicle.elev": 12,
  "clavicle.prot": -16,
};

export const spec = buildExerciseSpec({
  id: "bent-over-overhand-grip-dumbbell-rear-delt-fly",
  catalogId: "1ae5c6f170d8800c86b0e19530eef337",
  name: "Bent-Over Overhand Grip Dumbbell Rear Delt Fly",
  defaultLoadKg: 6,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Raise", "T", "Lower", "Hang"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.4, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 8, torsoLeanDeg: 68 },
  apparatus: { kind: "dumbbells" },
  stiffness: { elbow: 5, shoulder: 0.65, lumbar: 10, hip: 5, knee: 4 },
  hints: {
    start: { ...HINGE, ...HANG },
    end: { ...HINGE, ...T },
  },
  checks: () => [
    checkFlatBack("Keep the hinged torso still. Do not move the hips or the knees to lift the bells."),
    checkNeutralNeck("Keep the neck near neutral while the torso stays hinged."),
    checkJointWithinAt(
      "overhand",
      "Overhand grip",
      "Hold the dumbbells with the palms facing back toward you.",
      "forearm_L.pron",
      "start",
      50,
      95,
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
      "Lower the dumbbells back in front of the knees without standing up.",
      "shoulder_L.plane",
      40,
    ),
  ],
});
