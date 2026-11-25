import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * Pin-loaded incline row (Atlantis-style): chest on an incline pad, neutral handles
 * pulled up and back toward the lower ribs.
 */
const BENCH_TOP = 0.78;

const TRUNK = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.84,
  "root.z": -0.16,
  "root.pitch": 78,
  "hip.flex": 8,
  "hip.abd": 8,
  "knee.flex": 12,
  "ankle.dorsi": 4,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": -10,
};

const GRIP = {
  "shoulder.twist": 4,
  "forearm.pron": 4,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "neutral-grip-pin-loaded-machine-incline-row",
  catalogId: "3aa5c6f170d880f98633df6bbaf3663e",
  name: "Neutral Grip Pin-Loaded Machine Incline Row",
  defaultLoadKg: 20,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Ribs", "Lower", "Hang"],
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
    orientation: "neutral",
    forceDir: [0, -1, 0.1],
  },
  hints: {
    start: { ...TRUNK, ...GRIP, "shoulder.elev": 64, "shoulder.plane": 70, "elbow.flex": 8, "clavicle.prot": 6, "clavicle.elev": 2 },
    end: { ...TRUNK, ...GRIP, "shoulder.elev": 48, "shoulder.plane": 32, "elbow.flex": 108, "clavicle.prot": -16, "clavicle.elev": 6 },
  },
  checks: () => [
    checkFlatBack(
      "Keep the chest on the incline pad. Do not arch the lower back to help the handles up.",
    ),
    checkNeutralNeck("Tuck the chin enough to keep the face clear of the pad."),
    checkJointRange(
      "incline-row",
      "Handles travel up and back",
      "Pull the neutral handles up and back toward the lower ribs by driving the elbows back and bending them.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "hang",
      "Arms start long",
      "Start with the arms hanging and the elbows straight, shoulder blades spread.",
      "elbow_L.flex",
      "start",
      0,
      28,
    ),
    checkJointWithinAt(
      "neutral",
      "Neutral grip",
      "Hold the incline-row handles with a neutral grip, palms facing each other.",
      "forearm_L.pron",
      "start",
      -25,
      30,
    ),
    checkJointWithinAt(
      "elbows-tucked",
      "Elbows stay near the ribs",
      "Keep the elbows reasonably close to the sides as they drive up and back.",
      "shoulder_L.plane",
      "bottom",
      12,
      55,
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
