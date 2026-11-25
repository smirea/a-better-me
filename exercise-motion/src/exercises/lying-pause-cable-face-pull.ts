import { Vector3 } from "three";
import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { pin } from "../solver";

/**
 * Supine on the floor, reaching up toward a high-enough pulley, then pulling
 * the elbows down to the floor in a T and pausing there.
 */
const REACH = {
  "shoulder.elev": 118,
  "shoulder.plane": 78,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 70,
  "wrist.flex": 0,
  "clavicle.elev": 12,
  "clavicle.prot": 10,
};

const PULL = {
  "shoulder.elev": 78,
  "shoulder.plane": 8,
  "shoulder.twist": -55,
  "elbow.flex": 92,
  "forearm.pron": -22,
  "wrist.flex": 0,
  "clavicle.elev": 6,
  "clavicle.prot": -16,
};

const TRUNK = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.12,
  "root.pitch": -86,
  "lumbar.flex": -4,
  "thoracic.flex": -6,
  "neck.flex": -8,
  "hip.flex": 42,
  "hip.abd": 8,
  "knee.flex": 78,
  "ankle.dorsi": 8,
};

export const spec = buildExerciseSpec({
  id: "lying-pause-cable-face-pull",
  catalogId: "2ab5c6f170d8803388dff1a8b8452991",
  name: "Lying Pause Cable Face Pull",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Pause", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 2, raise: 1.6, top: 0.25 },
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    feetOnFloor: false,
    passiveJoints: ["lumbar", "thoracic", "hip", "knee", "ankle"],
  },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 1.15, 1.05],
    facingDir: -1,
    attachment: "rope",
    attachmentWidth: 1.2,
    freeGripWidth: true,
  },
  stiffness: { elbow: 1.6, shoulder: 0.8, lumbar: 8, hip: 4, knee: 4 },
  progress: (body, frame) => -anchorPoint(body, frame, "grip_L").z,
  extraGoals: (body) => [
    pin(body, "heel_L", () => new Vector3(0.16, 0.02, 0.42), 22),
    pin(body, "heel_R", () => new Vector3(-0.16, 0.02, 0.42), 22),
  ],
  hints: {
    start: { ...TRUNK, ...REACH },
    end: { ...TRUNK, ...PULL },
  },
  checks: () => [
    checkFlatBack("Lie on the back and keep the torso on the floor through the pause."),
    checkNeutralNeck("The head can rest on the floor, or stay slightly lifted toward the pulley."),
    checkJointRange(
      "elbows-to-floor",
      "Elbows travel down toward the floor",
      "Drive the elbows down toward the floor while flaring them out, and pull the hands toward the floor behind the elbows.",
      "elbow_L.flex",
      55,
    ),
    checkJointWithinAt(
      "arms-out",
      "Arms start outstretched toward the pulley",
      "Start with the elbows straightened and the arms aligned with the cable.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "t-shape",
      "Upper arms finish in a T on the floor",
      "At the end the elbows point straight out to the sides so the upper arms form a T with the torso.",
      "shoulder_L.plane",
      "bottom",
      -12,
      32,
    ),
    checkJointWithinAt(
      "paused-rotation",
      "Pause with the hands behind the elbows",
      "Pause about two seconds with the hands pulled horizontally behind the elbows, in a double-biceps pose.",
      "shoulder_L.twist",
      "bottom",
      -90,
      -22,
    ),
  ],
});
