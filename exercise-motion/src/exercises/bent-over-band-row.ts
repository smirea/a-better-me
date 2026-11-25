import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * Stand on the middle of a long band, hinge at the hips, and row both hands to the ribs.
 * Standard form: neutral spine, knees soft, elbows travel back close to the sides.
 */
const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.88,
  "root.z": -0.06,
  "root.pitch": 58,
  "hip.flex": 74,
  "hip.abd": 6,
  "knee.flex": 22,
  "ankle.dorsi": 8,
  "lumbar.flex": 6,
  "thoracic.flex": 8,
  "neck.flex": -6,
};

const HANG = {
  "shoulder.elev": 48,
  "shoulder.plane": 74,
  "shoulder.twist": 10,
  "elbow.flex": 8,
  "forearm.pron": 18,
  "wrist.flex": 4,
  "clavicle.elev": 4,
  "clavicle.prot": 2,
};

const ROW = {
  "shoulder.elev": 32,
  "shoulder.plane": 36,
  "shoulder.twist": 12,
  "elbow.flex": 108,
  "forearm.pron": 16,
  "wrist.flex": 4,
  "clavicle.elev": 8,
  "clavicle.prot": -16,
};

export const spec = buildExerciseSpec({
  id: "bent-over-band-row",
  catalogId: "30d5c6f170d880d69c07e45194b0e0a8",
  name: "Bent-Over Band Row",
  defaultLoadKg: 12,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Ribs", "Lower", "Hang"],
  tempo: { lower: 1.3, bottom: 0.25, raise: 1.4, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 8, torsoLeanDeg: 58 },
  apparatus: {
    kind: "band",
    anchors: [
      [-0.16, 0.02, 0.08],
      [0.16, 0.02, 0.08],
    ],
  },
  stiffness: { elbow: 3, shoulder: 1.2, lumbar: 10, thoracic: 8, hip: 6, knee: 5 },
  hints: {
    start: { ...HINGE, ...HANG },
    end: { ...HINGE, ...ROW },
  },
  checks: () => [
    checkFlatBack(
      "Hinge at the hips with a long neutral spine and soft knees, and keep that torso angle still while you row.",
    ),
    checkNeutralNeck(
      "Keep the neck near neutral, in line with the hinged torso, rather than looking straight up.",
    ),
    checkJointWithinAt(
      "arms-hang",
      "Arms hang toward the band",
      "Start standing on the band with the arms hanging and the elbows straight, so the band is already taut.",
      "elbow_L.flex",
      "start",
      0,
      28,
    ),
    checkJointWithinAt(
      "elbows-to-ribs",
      "Elbows finish by the ribs",
      "Row the hands up toward the lower ribs, driving the elbows back close to the sides.",
      "elbow_L.flex",
      "peak",
      85,
      135,
    ),
    checkJointRange(
      "elbow-row",
      "Elbows bend through the row",
      "Pull the hands to the ribs by bending the elbows and retracting the shoulder blades, then lower under control.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "scapulae",
      "Shoulder blades pull together",
      "Finish the pull by squeezing the shoulder blades together, as if pinching a pencil between them.",
      "clavicle_L.prot",
      "peak",
      -28,
      -4,
    ),
  ],
});
