import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Chest on a low incline. Arms hang straight; only the shoulder blades lift the dumbbells. */
const TRUNK = {
  "root.y": 0.84,
  "root.z": -0.18,
  "root.pitch": 82,
  "hip.flex": 6,
  "hip.abd": 12,
  "knee.flex": 8,
  "ankle.dorsi": 6,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": -12,
};

const HANG = {
  "shoulder.elev": 64,
  "shoulder.plane": 84,
  "shoulder.twist": 0,
  "elbow.flex": 6,
  "forearm.pron": 0,
  "wrist.flex": 2,
  "clavicle.elev": 2,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-kelso-shrug",
  catalogId: "1a15c6f170d880148cade872878baf4c",
  name: "Dumbbell Kelso Shrug",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Retract", "Pinch", "Release", "Stretch"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.5, top: 0.3 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "down",
    benchTopY: 0.78,
    feetOnFloor: false,
  },
  apparatus: { kind: "dumbbells" },
  stiffness: { elbow: 8, shoulder: 2.2, lumbar: 10, thoracic: 8, clavicle: 0.65 },
  hints: {
    start: { ...TRUNK, ...HANG, "clavicle.prot": 16 },
    end: { ...TRUNK, ...HANG, "shoulder.elev": 76, "clavicle.prot": -18, "clavicle.elev": 8 },
  },
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "elbow_L.flex", 6, 36),
      lockAngle(body, "elbow_R.flex", 6, 36),
      lockAngle(body, "clavicle_L.prot", 16, 32),
      lockAngle(body, "clavicle_R.prot", 16, 32),
    ],
    end: [
      lockAngle(body, "elbow_L.flex", 6, 36),
      lockAngle(body, "elbow_R.flex", 6, 36),
      lockAngle(body, "clavicle_L.prot", -18, 32),
      lockAngle(body, "clavicle_R.prot", -18, 32),
    ],
  }),
  checks: () => [
    checkFlatBack(
      "Keep the chest in contact with the bench. The dumbbells rise because the shoulder blades pinch, not because the elbows bend.",
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay extended",
      "Pull the shoulder blades backward and toward each other while the elbows stay extended.",
      "elbow_L.flex",
      "peak",
      0,
      20,
    ),
    checkJointWithinAt(
      "protracted",
      "Shoulder blades start spread",
      "Let the shoulder blades move forward beyond a resting posture so the dumbbells descend.",
      "clavicle_L.prot",
      "top",
      6,
      28,
    ),
    checkJointWithinAt(
      "retracted",
      "Shoulder blades pinch",
      "Pinch a pencil between the shoulder blades. That lifts the dumbbells a short distance.",
      "clavicle_L.prot",
      "bottom",
      -30,
      -8,
    ),
    checkJointRange(
      "scapular-retraction",
      "Shoulder blades travel from stretch to pinch",
      "Alternate a full spread of the shoulder blades with a full pinch, elbows straight and chest on the bench.",
      "clavicle_L.prot",
      18,
    ),
  ],
});
