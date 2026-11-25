import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Shoulder-height pulley. One arm sweeps horizontally from across the body out to a half-T. */
const STANCE = {
  ...POSTURE_HINTS.standing,
  "root.z": -0.06,
  "root.x": 0.06,
  "knee.flex": 8,
  "hip.flex": 4,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
};

const ACROSS = {
  "shoulder.elev": 82,
  "shoulder.plane": 90,
  "shoulder.twist": 10,
  "elbow.flex": 16,
  "forearm.pron": 70,
  "wrist.flex": 0,
  "clavicle.elev": 6,
  "clavicle.prot": 6,
};

const OUT = {
  "shoulder.elev": 86,
  "shoulder.plane": 40,
  "shoulder.twist": 8,
  "elbow.flex": 16,
  "forearm.pron": 68,
  "wrist.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": -10,
};

const FREE = {
  "shoulder.elev": 16,
  "shoulder.plane": 20,
  "elbow.flex": 14,
  "forearm.pron": 12,
  "clavicle.elev": 2,
};

export const spec = buildExerciseSpec({
  id: "single-arm-cable-rear-delt-fly",
  catalogId: "3065c6f170d880eea408cc28767961ae",
  name: "Single Arm Cable Rear Delt Fly",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Sweep", "Half T", "Return", "Across"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.4, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: {
    kind: "cable-single",
    pulley: [-0.78, 1.32, 0.32],
    facingDir: -1,
    attachment: "d-handle",
    sides: ["L"],
  },
  stiffness: { elbow: 6, shoulder: 2.4, lumbar: 9 },
  hints: {
    start: sidedHints("L", ACROSS, FREE, STANCE),
    end: sidedHints("L", OUT, FREE, STANCE),
  },
  checks: () => [
    checkFlatBack("Keep the chest and belt buckle facing forward. Do not twist the torso."),
    checkJointWithinAt(
      "across",
      "Arm starts across the body",
      "Reach across the body toward the shoulder-height pulley before each sweep.",
      "shoulder_L.plane",
      "start",
      70,
      120,
    ),
    checkJointWithinAt(
      "half-t",
      "Arm finishes straight out to the side",
      "Finish once the arm points straight out from the shoulder, half of a T.",
      "shoulder_L.plane",
      "peak",
      20,
      85,
    ),
    checkJointWithinAt(
      "elbow-quiet",
      "Elbow stays softly straight",
      "Sweep the arm without bending the elbow.",
      "elbow_L.flex",
      "peak",
      0,
      32,
    ),
    checkJointRange(
      "horizontal-sweep",
      "Arm arcs across to the side",
      "Sweep out in a wide arc, then resist the cable back across the body.",
      "shoulder_L.plane",
      28,
    ),
  ],
});
