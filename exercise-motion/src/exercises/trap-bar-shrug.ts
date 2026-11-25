import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** High handles, palms facing each other, arms long beside the thighs. */
const ARMS = {
  "shoulder.plane": 14,
  "shoulder.twist": 0,
  "elbow.flex": 8,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.prot": 2,
};

export const spec = buildExerciseSpec({
  id: "trap-bar-shrug",
  catalogId: "1a15c6f170d88058affcfe5558485d48",
  name: "Trap Bar Shrug",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Shrug", "Ears", "Lower", "Depressed"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.2, top: 0.35 },
  station: { kind: "standing", stanceX: 0.18, toeOutDeg: 8 },
  apparatus: {
    kind: "barbell",
    style: "trap",
    gripX: 0.31,
    alignWrists: false,
  },
  stiffness: { elbow: 6, knee: 4, hip: 3, lumbar: 8, clavicle: 1.1 },
  progress: (body, frame) => anchorPoint(body, frame, "grip_L").y,
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 10, "clavicle.elev": -6 },
    end: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 14, "clavicle.elev": 26 },
  },
  checks: () => [
    checkFlatBack(
      "Stand upright inside the trap bar with the elbows straight and the lower back near neutral.",
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
      "depressed-start",
      "Shoulders start slightly depressed",
      "At the bottom the shoulders sit a little lower than a relaxed standing posture from the weight's stretch.",
      "clavicle_L.elev",
      "start",
      -12,
      6,
    ),
    checkJointRange(
      "scapular-elevation",
      "Shoulder girdle elevates",
      "Shrug upward through the available range, then lower the shoulders under control.",
      "clavicle_L.elev",
      18,
    ),
  ],
});
