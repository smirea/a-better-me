import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Pin-loaded incline row, pronated handles, elbows flare as they drive up-back. */
const BENCH_TOP = 0.78;

const TRUNK = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.84,
  "root.z": -0.16,
  "root.pitch": 78,
  "hip.flex": 8,
  "hip.abd": 10,
  "knee.flex": 12,
  "ankle.dorsi": 4,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": -10,
};

const GRIP = {
  "shoulder.twist": 14,
  "forearm.pron": 74,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "overhand-grip-pin-loaded-machine-incline-row",
  catalogId: "3ab5c6f170d880b6bea9d22772736593",
  name: "Overhand Grip Pin-Loaded Machine Incline Row",
  defaultLoadKg: 20,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Chest", "Lower", "Hang"],
  tempo: { lower: 1.3, bottom: 0.3, raise: 1.5, top: 0.3 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "down",
    benchTopY: BENCH_TOP,
    feetOnFloor: false,
  },
  extraContacts: {
    handle_L: { upperarm_L: 0.1, chest: 0.12, thigh_L: 0.1, shank_L: 0.1, forearm_L: 0.08, pelvis: 0.08 },
    handle_R: { upperarm_R: 0.1, chest: 0.12, thigh_R: 0.1, shank_R: 0.1, forearm_R: 0.08, pelvis: 0.08 },
  },
  stiffness: { lumbar: 12, thoracic: 10, hip: 5, knee: 4, elbow: 2.2, shoulder: 1.2 },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    forceDir: [0, -1, 0.1],
  },
  hints: {
    start: { ...TRUNK, ...GRIP, "shoulder.elev": 66, "shoulder.plane": 82, "elbow.flex": 8, "clavicle.prot": 6, "clavicle.elev": 4 },
    end: { ...TRUNK, ...GRIP, "shoulder.elev": 54, "shoulder.plane": 28, "elbow.flex": 106, "clavicle.prot": -16, "clavicle.elev": 8 },
  },
  checks: () => [
    checkFlatBack(
      "Keep the chest on the incline pad. Do not arch the lower back to help the handles up.",
    ),
    checkNeutralNeck("Tuck the chin enough to keep the face clear of the pad."),
    checkJointRange(
      "incline-overhand-row",
      "Handles travel up and back",
      "Row the overhand handles up and back by driving the elbows out and back while bending them.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "hang",
      "Arms start long",
      "Start with the arms hanging and the elbows straight.",
      "elbow_L.flex",
      "start",
      0,
      28,
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip",
      "Take a pronated overhand grip so the palms face backward on the incline-row handles.",
      "forearm_L.pron",
      "start",
      45,
      90,
    ),
    checkJointWithinAt(
      "elbows-out",
      "Elbows flare",
      "Let the elbows travel out away from the ribs as the upper arms approach the torso.",
      "shoulder_L.plane",
      "bottom",
      8,
      52,
    ),
    checkJointWithinAt(
      "scapulae",
      "Shoulder blades pinch",
      "Finish with the shoulder blades squeezed together.",
      "clavicle_L.prot",
      "peak",
      -40,
      -4,
    ),
  ],
});
