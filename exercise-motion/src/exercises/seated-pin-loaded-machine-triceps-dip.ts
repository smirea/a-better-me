import { buildExerciseSpec } from "../builders";
import { checkFeetPlanted, checkJointRange, checkJointWithinAt, POSTURE_HINTS } from "../postures";

/** Pin-loaded seated dip: same press-down path, stack behind the seat. */
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
  "shoulder.elev": 64,
  "shoulder.plane": -24,
  "shoulder.twist": 8,
  "elbow.flex": 110,
  "forearm.pron": 4,
  "wrist.flex": 2,
};

const ARMS_BOTTOM = {
  "clavicle.elev": -6,
  "clavicle.prot": -4,
  "shoulder.elev": 14,
  "shoulder.plane": 34,
  "shoulder.twist": 4,
  "elbow.flex": 6,
  "forearm.pron": 6,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "seated-pin-loaded-machine-triceps-dip",
  catalogId: "1a05c6f170d8807baa00ec5f6eee2896",
  name: "Seated Pin-Loaded Machine Triceps Dip",
  defaultLoadKg: 45,
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
    frame: { type: "machine", backAngleDeg: 88, stackZ: -0.78 },
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
    checkFeetPlanted("Keep the feet flat and the back against the pad."),
    checkJointWithinAt(
      "elbows-bent",
      "Elbows start behind the torso",
      "Pull the shoulder blades back and set the elbows behind the torso, bent at least 90 degrees.",
      "elbow_L.flex",
      "top",
      85,
      130,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Arms finish down by the sides",
      "Push the handles down until the elbows are fully straight.",
      "elbow_L.flex",
      "bottom",
      0,
      22,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows extend through the dip",
      "Drive the elbows down until they are straight.",
      "elbow_L.flex",
      75,
    ),
    checkJointRange(
      "shoulders-travel",
      "Elbows arc down from behind the torso",
      "The elbows move forward as they straighten.",
      "shoulder_L.elev",
      18,
    ),
  ],
});
