import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Wide snatch grip: each arm sits near 45° from the torso, elbows straight. */
const ARMS = {
  "shoulder.elev": 46,
  "shoulder.plane": 18,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 74,
  "wrist.flex": 4,
  "clavicle.prot": 4,
};

export const spec = buildExerciseSpec({
  id: "snatch-grip-shrug",
  catalogId: "1a15c6f170d880c68df7cd7ee49de492",
  name: "Snatch Grip Shrug",
  defaultLoadKg: 30,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Shrug", "Ears", "Lower", "Depressed"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.2, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.48,
  },
  stiffness: { elbow: 6, knee: 4, hip: 3, lumbar: 8, clavicle: 1.1 },
  progress: (body, frame) => anchorPoint(body, frame, "grip_L").y,
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "clavicle.elev": -6 },
    end: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 50, "clavicle.elev": 26 },
  },
  checks: () => [
    checkFlatBack("Stand upright with the wide snatch grip and the lower back near neutral."),
    checkNeutralNeck("Keep the neck neutral, as when you are standing upright and looking straight ahead."),
    checkJointWithinAt(
      "wide-arms",
      "Arms stay near 45° from the torso",
      "Spread the arms so each forms close to a 45° angle with the torso, which approximates a snatch grip.",
      "shoulder_L.elev",
      "peak",
      24,
      70,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay extended",
      "Shrug the shoulders upward while keeping the elbows extended.",
      "elbow_L.flex",
      "peak",
      0,
      18,
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
