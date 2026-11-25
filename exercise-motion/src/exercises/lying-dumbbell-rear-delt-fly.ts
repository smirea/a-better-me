import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

/** Supine. The working arm lowers across the chest, then sweeps back up until it is vertical. */
const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -8,
};

const ACROSS = {
  "shoulder.elev": 70,
  "shoulder.plane": 100,
  "shoulder.twist": 22,
  "elbow.flex": 8,
  "forearm.pron": 62,
  "wrist.flex": -4,
  "clavicle.elev": 2,
  "clavicle.prot": 4,
};

const UP = {
  "shoulder.elev": 92,
  "shoulder.plane": 70,
  "shoulder.twist": 28,
  "elbow.flex": 6,
  "forearm.pron": 60,
  "wrist.flex": -4,
  "clavicle.elev": 2,
  "clavicle.prot": -6,
};

const FREE = {
  "shoulder.elev": 28,
  "shoulder.plane": 40,
  "elbow.flex": 70,
  "forearm.pron": 20,
  "wrist.flex": 0,
  "clavicle.elev": 0,
  "clavicle.prot": 0,
};

export const spec = buildExerciseSpec({
  id: "lying-dumbbell-rear-delt-fly",
  catalogId: "2e85c6f170d88003ac95df8c66b346ad",
  name: "Lying Dumbbell Rear Delt Fly",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "press",
  phaseLabels: ["Sweep", "Vertical", "Lower", "Across"],
  tempo: { lower: 1.6, bottom: 0.25, raise: 1.4, top: 0.3 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.2,
    heelZ: 0.42,
    feetOnFloor: true,
  },
  apparatus: { kind: "dumbbells", sides: ["L"], anchor: "press" },
  stiffness: { elbow: 8, shoulder: 4, lumbar: 8 },
  hints: {
    start: { ...TRUNK, ...sidedHints("L", ACROSS, FREE) },
    end: { ...TRUNK, ...sidedHints("L", UP, FREE) },
  },
  checks: () => [
    checkFeetPlanted("Keep both feet on the floor with the knees bent."),
    checkJointWithinAt(
      "palm-forward",
      "Palm faces forward",
      "Point the palm forward so the bony bump on the back of the elbow faces out to the side.",
      "forearm_L.pron",
      "peak",
      40,
      90,
    ),
    checkJointWithinAt(
      "elbow-straight",
      "Elbow stays straight",
      "Keep the elbow straight through the arc.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "vertical",
      "Arm finishes near vertical",
      "Sweep the arm up until it is vertical or almost vertical over the shoulder.",
      "shoulder_L.elev",
      "peak",
      75,
      120,
    ),
    checkJointRange(
      "across-body",
      "Arm travels across the body and back up",
      "Lower across the body toward the opposite shoulder, then sweep back up.",
      "shoulder_L.plane",
      18,
    ),
  ],
});
