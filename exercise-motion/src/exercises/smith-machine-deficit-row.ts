import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Bumper-plate deficit so the torso can approach horizontal without the bar hitting the stops. */
const DEFICIT = 0.1;

const GRIP = {
  "shoulder.plane": 72,
  "shoulder.twist": 18,
  "forearm.pron": 75,
  "wrist.flex": 8,
};

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.84 + DEFICIT,
  "root.z": -0.08,
  "root.pitch": 70,
  "hip.flex": 90,
  "hip.abd": 6,
  "knee.flex": 28,
  "ankle.dorsi": 10,
  "lumbar.flex": 6,
  "thoracic.flex": 8,
  "neck.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "smith-machine-deficit-row",
  catalogId: "2a15c6f170d880a8b0b0f63c15a8ba94",
  name: "Smith Machine Deficit Row",
  defaultLoadKg: 35,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Upper abdomen", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.5, top: 0.35 },
  station: {
    kind: "standing",
    stanceX: 0.16,
    heelZ: -0.04,
    toeOutDeg: 8,
    torsoLeanDeg: 68,
    box: { height: DEFICIT, width: 0.55, depth: 0.42, z: -0.02 },
    smith: { stopY: 0.32 },
  },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.3,
    path: { startY: 0.5, startZ: 0.16, endY: 0.92, endZ: 0.16 },
  },
  hints: {
    start: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 54,
      "elbow.flex": 8,
      "clavicle.prot": -2,
      "clavicle.elev": 6,
    },
    end: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 36,
      "shoulder.plane": 40,
      "elbow.flex": 114,
      "clavicle.prot": -16,
      "clavicle.elev": 10,
    },
  },
  checks: () => [
    checkFlatBack(
      "Hinge as close to horizontal as a flat lower back allows. The deficit keeps the bar off the Smith stops.",
      14,
    ),
    checkNeutralNeck("Keep your chest up and your neck near neutral on the raised surface."),
    checkJointRange(
      "deficit-row",
      "Longer pull from the elevated stance",
      "Pull the bar up toward your upper abdomen while you stand on the deficit.",
      "elbow_L.flex",
      70,
    ),
    checkJointWithinAt(
      "deep-hinge",
      "Torso nearer horizontal",
      "Sit your hips back until you can no longer keep a flat back and vertical shins. That is the bottom of the hinge.",
      "hip_L.flex",
      "start",
      75,
      120,
    ),
    checkJointWithinAt(
      "hang",
      "Arms hang straight",
      "Lower the bar until your arms point down with straight elbows, still clear of the machine's bottom.",
      "elbow_L.flex",
      "start",
      0,
      28,
    ),
    checkJointWithinAt(
      "to-abdomen",
      "Bar finishes at the upper abdomen",
      "Row until the bar is close to your upper abdomen and your elbows are behind your torso or aligned with it.",
      "elbow_L.flex",
      "peak",
      90,
      145,
    ),
  ],
});
