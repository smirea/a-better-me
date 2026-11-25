import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Shoulder-width overhand grip, bar in front of the thighs. */
const ARMS = {
  "shoulder.plane": 78,
  "shoulder.twist": 10,
  "elbow.flex": 8,
  "forearm.pron": 76,
  "wrist.flex": 4,
  "clavicle.prot": 2,
};

export const spec = buildExerciseSpec({
  id: "barbell-shrug",
  catalogId: "1a15c6f170d88061b074caacc5a76081",
  name: "Barbell Shrug",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Shrug", "Ears", "Lower", "Depressed"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.2, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.24,
  },
  extraContacts: { bar: { thigh_L: 0.04, thigh_R: 0.04 } },
  stiffness: { elbow: 6, knee: 4, hip: 3, lumbar: 8, clavicle: 1.1 },
  progress: (body, frame) => anchorPoint(body, frame, "grip_L").y,
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 12, "clavicle.elev": -6 },
    end: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 16, "clavicle.elev": 26 },
  },
  checks: () => [
    checkFlatBack(
      "Stand upright with a shoulder-width overhand grip and keep the lower back near neutral.",
    ),
    checkNeutralNeck("Keep the neck neutral, as when you are standing upright and looking straight ahead."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay extended",
      "Shrug the shoulders upward through the available range while keeping the elbows extended.",
      "elbow_L.flex",
      "peak",
      0,
      18,
    ),
    checkJointWithinAt(
      "shoulders-up",
      "Shoulders finish elevated",
      "Lift the bar by elevating the shoulder girdle toward the ears.",
      "clavicle_L.elev",
      "peak",
      16,
      36,
    ),
    checkJointRange(
      "scapular-elevation",
      "Shoulder girdle elevates",
      "Allow the shoulders to descend a little below rest, then shrug them back up.",
      "clavicle_L.elev",
      18,
    ),
  ],
});
