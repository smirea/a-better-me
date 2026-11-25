import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Low straight bar, shoulder-width overhand grip, arms long. */
const ARMS = {
  "shoulder.plane": 70,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 74,
  "wrist.flex": 4,
  "clavicle.prot": 2,
};

export const spec = buildExerciseSpec({
  id: "cable-shrug",
  catalogId: "1a15c6f170d8803fbfb3de3621bd96b5",
  name: "Cable Shrug",
  defaultLoadKg: 18,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Shrug", "Ears", "Lower", "Depressed"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.2, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 0.22, 0.62],
    columnPos: [0, 0.85],
    facingDir: -1,
    attachment: "straight-bar",
    attachmentWidth: 0.7,
    gripX: 0.24,
  },
  stiffness: { elbow: 6, knee: 4, lumbar: 8, clavicle: 1.1 },
  progress: (body, frame) => anchorPoint(body, frame, "grip_L").y,
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 14, "clavicle.elev": -6 },
    end: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 16, "clavicle.elev": 26 },
  },
  checks: () => [
    checkFlatBack(
      "Stand upright in front of a low cable with the elbows extended and the lower back near neutral.",
    ),
    checkNeutralNeck("Keep the neck neutral, as when you are standing upright and looking straight ahead."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay extended",
      "Shrug the shoulders upward while keeping the elbows extended so the bar rises.",
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
      "Let the cable depress the shoulders, then shrug up and lower under control with tension still on the cable.",
      "clavicle_L.elev",
      18,
    ),
  ],
});
