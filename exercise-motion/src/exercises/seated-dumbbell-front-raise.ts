import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Neutral grip, bells at the sides of an upright bench, then straight out in front. */
const DOWN = {
  "shoulder.elev": 58,
  "shoulder.plane": 72,
  "shoulder.twist": 4,
  "elbow.flex": 6,
  "forearm.pron": 4,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

const UP = {
  ...DOWN,
  "shoulder.elev": 90,
  "shoulder.plane": 84,
  "forearm.pron": 8,
  "clavicle.elev": 12,
  "clavicle.prot": 4,
};

export const spec = buildExerciseSpec({
  id: "seated-dumbbell-front-raise",
  catalogId: "1a15c6f170d88021b875e863950a8388",
  name: "Seated Dumbbell Front Raise",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Raise", "Shoulder height", "Lower", "Sides"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.4, top: 0.35 },
  station: {
    kind: "seated",
    seatY: 0.43,
    stanceX: 0.22,
    heelZ: 0.4,
    frame: { type: "adjustable-bench", backAngleDeg: 82 },
  },
  apparatus: { kind: "dumbbells" },
  stiffness: { elbow: 6, shoulder: 0.7 },
  hints: {
    start: { ...POSTURE_HINTS.seatedLeanBack, ...DOWN, "root.pitch": -8 },
    end: { ...POSTURE_HINTS.seatedLeanBack, ...UP, "root.pitch": -8 },
  },
  extraContacts: {
    "bench.backPad": { pelvis: 0.05, abdomen: 0.04, girdle: 0.045 },
    "bench.seatPad": { thigh_L: 0.05, thigh_R: 0.05, thighShaft_L: 0.05, thighShaft_R: 0.05 },
  },
  checks: () => [
    checkFlatBack(
      "Sit on a bench with an upright posture and keep the torso still while the arms raise.",
    ),
    checkJointWithinAt(
      "neutral-grip",
      "Neutral grip",
      "Hold the dumbbells at your sides with extended elbows as your palms face in toward your sides.",
      "forearm_L.pron",
      "start",
      -25,
      30,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay extended",
      "Hold the dumbbells at your sides with extended elbows.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "shoulder-height",
      "Upper arms finish parallel to the floor",
      "Raise the dumbbells out in front of you until your upper arms are approximately parallel with the ground.",
      "shoulder_L.elev",
      "peak",
      70,
      115,
    ),
    checkJointRange(
      "shoulder-flexion",
      "Shoulders flex through the raise",
      "Alternate between raising the dumbbells up and lowering them down.",
      "shoulder_L.elev",
      28,
    ),
  ],
});
