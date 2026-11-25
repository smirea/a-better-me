import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Power shrug: a short dip above the knees, then an explosive hip drive with the shrug. */
const ARMS = {
  "shoulder.plane": 72,
  "shoulder.twist": 10,
  "elbow.flex": 8,
  "forearm.pron": 76,
  "wrist.flex": 4,
};

const DIP = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.9,
  "root.pitch": 16,
  "hip.flex": 28,
  "knee.flex": 24,
  "ankle.dorsi": 6,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "barbell-cheat-shrug",
  catalogId: "1a15c6f170d8808eb30fefbf4a18d7b8",
  name: "Barbell Cheat Shrug",
  defaultLoadKg: 50,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Drive", "Shrug", "Dip", "Above knees"],
  tempo: { lower: 1.2, bottom: 0.2, raise: 0.7, top: 0.25 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 8 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.24,
    path: { startY: 0.58, startZ: 0.2, endY: 0.82, endZ: 0.14, arcBulgeZ: 0.02 },
  },
  extraContacts: { bar: { thigh_L: 0.045, thigh_R: 0.045 } },
  stiffness: { elbow: 5, lumbar: 7, clavicle: 1.1 },
  progress: (body, frame) => anchorPoint(body, frame, "grip_L").y,
  hints: {
    start: { ...DIP, ...ARMS, "shoulder.elev": 18, "clavicle.elev": -4, "clavicle.prot": 4 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "shoulder.elev": 16,
      "clavicle.elev": 26,
      "clavicle.prot": 0,
      "hip.flex": 4,
      "knee.flex": 4,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep the elbows extended and the lower back near neutral while the hips and knees help the bar up.",
      16,
    ),
    checkNeutralNeck("Keep the neck near neutral, as when you are standing upright and looking straight ahead."),
    checkJointRange(
      "knee-dip",
      "Knees dip and drive",
      "Mildly bend the knees to set the bar just above them, then vigorously extend the knees with the shrug.",
      "knee_L.flex",
      12,
    ),
    checkJointRange(
      "hip-drive",
      "Hips extend with the shrug",
      "Extend the hips explosively as the shoulders shrug upward.",
      "hip_L.flex",
      14,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay extended",
      "Keep the elbows extended through the dip and the shrug.",
      "elbow_L.flex",
      "peak",
      0,
      20,
    ),
    checkJointRange(
      "scapular-elevation",
      "Shoulder girdle elevates",
      "Shrug the shoulders upward through the available range as the legs drive.",
      "clavicle_L.elev",
      16,
    ),
  ],
});
