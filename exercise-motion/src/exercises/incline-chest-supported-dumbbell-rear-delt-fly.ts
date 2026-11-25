import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Chest on a moderate incline. Straight arms sweep back and out on a diagonal. */
const TRUNK = {
  "root.y": 0.84,
  "root.z": -0.18,
  "root.pitch": 78,
  "hip.flex": 8,
  "hip.abd": 12,
  "knee.flex": 10,
  "ankle.dorsi": 6,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": -12,
};

const HANG = {
  "shoulder.elev": 48,
  "shoulder.plane": 78,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 42,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": 4,
};

const BACK = {
  ...HANG,
  "shoulder.elev": 100,
  "shoulder.plane": -28,
  "clavicle.elev": 14,
  "clavicle.prot": -8,
};

export const spec = buildExerciseSpec({
  id: "incline-chest-supported-dumbbell-rear-delt-fly",
  catalogId: "2ab5c6f170d8806a8530f125edcbb0bd",
  name: "Incline Chest-Supported Dumbbell Rear Delt Fly",
  defaultLoadKg: 5,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Sweep", "Back", "Lower", "Hang"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.5, top: 0.3 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "down",
    benchTopY: 0.78,
    feetOnFloor: false,
  },
  apparatus: { kind: "dumbbells" },
  stiffness: { elbow: 7, shoulder: 0.65, lumbar: 10, thoracic: 8 },
  hints: {
    start: { ...TRUNK, ...HANG },
    end: { ...TRUNK, ...BACK },
  },
  checks: () => [
    checkFlatBack("Keep the chest on the bench. The arms move; the torso stays put."),
    checkJointWithinAt(
      "hybrid-grip",
      "Palms angle in and back",
      "Keep the hybrid grip, palms angled diagonally in toward each other and backward.",
      "forearm_L.pron",
      "start",
      18,
      62,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Keep the elbows straightened throughout the sweep.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "diagonal",
      "Arms finish back and out",
      "Sweep equal parts backward and outward so the arms sit about 45 degrees out at the top.",
      "shoulder_L.plane",
      "peak",
      -50,
      -4,
    ),
    checkJointRange(
      "rear-sweep",
      "Arms rise from a hang to behind the torso",
      "Lower the arms until the dumbbells point down under the shoulders.",
      "shoulder_L.elev",
      28,
    ),
  ],
});
