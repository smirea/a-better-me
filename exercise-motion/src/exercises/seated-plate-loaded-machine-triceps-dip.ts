import { buildExerciseSpec } from "../builders";
import { checkFeetPlanted, checkJointRange, checkJointWithinAt, POSTURE_HINTS } from "../postures";

/** Upright dip machine: handles beside the lower chest, elbows travel back then down. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": -4,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "neck.flex": 4,
  "hip.flex": 90,
  "knee.flex": 90,
};

const ARMS_TOP = {
  "clavicle.elev": -2,
  "clavicle.prot": -10,
  "shoulder.elev": 62,
  "shoulder.plane": -28,
  "shoulder.twist": 8,
  "elbow.flex": 108,
  "forearm.pron": 6,
  "wrist.flex": 2,
};

const ARMS_BOTTOM = {
  "clavicle.elev": -6,
  "clavicle.prot": -4,
  "shoulder.elev": 16,
  "shoulder.plane": 36,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 8,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "seated-plate-loaded-machine-triceps-dip",
  catalogId: "25c5c6f170d88043b068f3225ed86f77",
  name: "Seated Plate-Loaded Machine Triceps Dip",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Return", "Stretch"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.3, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.46,
    stanceX: 0.18,
    heelZ: 0.38,
    leanDeg: -4,
    frame: { type: "machine", backAngleDeg: 88, stackZ: -0.62 },
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    anchor: "press",
    forceDir: [0, 1, 0.05],
    handPath: { start: [0.28, 0.96, 0.16], end: [0.26, 0.7, 0.28], arcBulge: [0, 0, 0.02] },
  },
  stiffness: { elbow: 4, shoulder: 0.9, lumbar: 7 },
  extraContacts: {
    "handle_L.arm": { upperarm_L: 0.08, forearm_L: 0.05 },
    "handle_R.arm": { upperarm_R: 0.08, forearm_R: 0.05 },
  },
  hints: {
    start: { ...SEAT, ...ARMS_TOP },
    end: { ...SEAT, ...ARMS_BOTTOM },
  },
  checks: () => [
    checkFeetPlanted("Keep the feet flat and the torso upright against the pad."),
    checkJointWithinAt(
      "elbows-bent",
      "Elbows start behind the torso",
      "Start with the elbows back behind the torso, bent at least 90 degrees, tucked near the sides.",
      "elbow_L.flex",
      "top",
      85,
      130,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Arms finish down by the sides",
      "Push the handles down until the elbows are straight and the arms point toward the floor.",
      "elbow_L.flex",
      "bottom",
      0,
      22,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows extend through the dip",
      "Drive the elbows down and forward until they are straight.",
      "elbow_L.flex",
      75,
    ),
    checkJointRange(
      "shoulders-travel",
      "Elbows arc down from behind the torso",
      "The elbows move forward as they straighten. This is a dip, not a fixed-arm extension.",
      "shoulder_L.elev",
      18,
    ),
  ],
});
