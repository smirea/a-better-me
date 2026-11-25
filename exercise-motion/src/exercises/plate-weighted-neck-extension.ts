import { buildExerciseSpec } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/**
 * Prone on a flat bench, chest supported, plate resting on the back of the skull.
 * The plate prop is locked between the hands and collides with the head, so the
 * load is a short roller on the occiput while the hands stay beside the head.
 */
const PRONE = {
  "root.y": 0.58,
  "root.z": 0.02,
  "root.pitch": 76,
  "hip.flex": 8,
  "hip.abd": 12,
  "knee.flex": 24,
  "ankle.dorsi": 6,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "shoulder.elev": 70,
  "shoulder.plane": 50,
  "shoulder.twist": 20,
  "elbow.flex": 110,
  "forearm.pron": 10,
  "wrist.flex": 4,
  "clavicle.elev": 4,
  "clavicle.prot": 2,
};

export const spec = buildExerciseSpec({
  id: "plate-weighted-neck-extension",
  catalogId: "1a45c6f170d8808bb970dd2156495ae2",
  name: "Plate-Weighted Neck Extension",
  defaultLoadKg: 5,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Lift", "Forward", "Lower", "Chin"],
  tempo: { lower: 2.2, bottom: 0.35, raise: 2.0, top: 0.35 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "down",
    benchTopY: 0.48,
    feetOnFloor: false,
    passiveJoints: ["hip", "knee", "ankle", "shoulder", "elbow"],
  },
  apparatus: {
    kind: "roller-pad",
    trackAnchors: ["occiput"],
    offset: [0, 0.04, 0],
    forceDir: [0, -1, 0],
    width: 0.18,
    radius: 0.04,
  },
  extraContacts: { roller: { head: 0.05 }, "bench.pad": { thigh_L: 0.05, thigh_R: 0.05, shank_L: 0.04, shank_R: 0.04 } },
  stiffness: { neck: 0.55, hip: 6, knee: 6 },
  hints: {
    start: { ...PRONE, "neck.flex": 36 },
    end: { ...PRONE, "neck.flex": -16 },
  },
  checks: () => [
    checkJointWithinAt(
      "chin-tucked",
      "Chin starts toward the collarbone",
      "Nod the head so the chin moves toward the collarbone before the plate is lifted.",
      "neck.flex",
      "start",
      18,
      52,
    ),
    checkJointWithinAt(
      "face-forward",
      "Face finishes angled forward",
      "Tilt the head up until the face points forward. Do not crank past a comfortable range.",
      "neck.flex",
      "peak",
      -32,
      4,
    ),
    checkJointRange(
      "neck-extension",
      "Neck extends under the plate",
      "Lift the plate with the neck while the chest stays on the bench.",
      "neck.flex",
      28,
    ),
    checkJointWithinAt(
      "chest-down",
      "Chest stays on the bench",
      "Continue keeping your chest on the bench.",
      "thoracic.flex",
      "peak",
      -10,
      16,
    ),
  ],
});
