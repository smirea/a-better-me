import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Plate-loaded high row: arms start overhead and drive down-back to the ribs. */
const SEAT = {
  ...POSTURE_HINTS.seatedLeanBack,
  "root.pitch": -6,
  "hip.flex": 84,
  "knee.flex": 90,
  "lumbar.flex": 2,
  "thoracic.flex": -2,
  "neck.flex": -4,
};

const UP = {
  "shoulder.elev": 150,
  "shoulder.plane": 62,
  "shoulder.twist": 6,
  "elbow.flex": 8,
  "forearm.pron": 12,
  "wrist.flex": 2,
  "clavicle.elev": 14,
  "clavicle.prot": 6,
};

const DOWN = {
  "shoulder.elev": 38,
  "shoulder.plane": 36,
  "shoulder.twist": 4,
  "elbow.flex": 108,
  "forearm.pron": 10,
  "wrist.flex": 4,
  "clavicle.elev": -10,
  "clavicle.prot": -14,
};

export const spec = buildExerciseSpec({
  id: "plate-loaded-machine-high-row",
  catalogId: "2e75c6f170d8804c8a2bdfec2fab3fc8",
  name: "Plate-Loaded Machine High Row",
  defaultLoadKg: 20,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Ribs", "Return", "Reach"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.7, top: 0.35 },
  station: {
    kind: "seated",
    seatY: 0.46,
    seatZ: -0.02,
    stanceX: 0.16,
    heelZ: 0.34,
    leanDeg: -6,
    frame: { type: "lat-pulldown", thighPadY: 0.64, pulleyZ: 0.28, columnZ: 1.15 },
    feetMode: "floor",
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    forceDir: [0, 1, 0.25],
  },
  extraContacts: {
    handle_L: { upperarm_L: 0.1, chest: 0.12, thigh_L: 0.1, shank_L: 0.1, forearm_L: 0.08, pelvis: 0.08 },
    handle_R: { upperarm_R: 0.1, chest: 0.12, thigh_R: 0.1, shank_R: 0.1, forearm_R: 0.08, pelvis: 0.08 },
  },
  stiffness: { elbow: 2.4, shoulder: 1.2, clavicle: 0.8 },
  hints: { start: { ...SEAT, ...UP }, end: { ...SEAT, ...DOWN } },
  checks: () => [
    checkFlatBack(
      "Keep your torso in the same position throughout your set rather than progressively leaning backward.",
    ),
    checkNeutralNeck("Keep the neck quiet against the torso pad while the arms travel overhead."),
    checkJointRange(
      "high-row",
      "Elbows drive down and back",
      "Drive your elbows down and back toward your sides while progressively bending them to pull the handles toward you.",
      "elbow_L.flex",
      70,
    ),
    checkJointWithinAt(
      "arms-overhead",
      "Arms start overhead",
      "When sitting down, allow your elbows to straighten and your arms to raise overhead in line with the machine’s resistance.",
      "shoulder_L.elev",
      "top",
      120,
      175,
    ),
    checkJointWithinAt(
      "elbows-behind",
      "Elbows finish beside the torso",
      "Pull through your full range of motion, which will typically result in your elbows finishing slightly behind your torso.",
      "elbow_L.flex",
      "bottom",
      85,
      140,
    ),
    checkJointWithinAt(
      "scapulae-down",
      "Shoulder blades pull down and back",
      "Simultaneously pull your shoulder blades down and back together, as if pinching a pencil between them.",
      "clavicle_L.prot",
      "bottom",
      -40,
      -4,
    ),
  ],
});
