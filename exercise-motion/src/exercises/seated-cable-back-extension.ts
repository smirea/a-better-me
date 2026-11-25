import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Straight elbows on a straight bar, overhand. */
const GRIP = {
  "shoulder.twist": 12,
  "elbow.flex": 6,
  "forearm.pron": 74,
  "wrist.flex": 4,
};

/** Rounded reach, arms long, scapulae apart. */
const ROUND = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 8,
  "hip.flex": 90,
  "knee.flex": 70,
  "lumbar.flex": 24,
  "thoracic.flex": 16,
  "neck.flex": 6,
  ...GRIP,
  "shoulder.elev": 86,
  "shoulder.plane": 74,
  "clavicle.prot": 14,
  "clavicle.elev": 6,
};

/** Upright, proud chest, mild lumbar arch, elbows still straight, shoulder blades back. */
const TALL = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 2,
  "hip.flex": 88,
  "knee.flex": 62,
  "lumbar.flex": -8,
  "thoracic.flex": -6,
  "neck.flex": 2,
  ...GRIP,
  "shoulder.elev": 48,
  "shoulder.plane": 62,
  "clavicle.prot": -12,
  "clavicle.elev": 4,
};

export const spec = buildExerciseSpec({
  id: "seated-cable-back-extension",
  catalogId: "2bf5c6f170d880d49062efec2b0c98de",
  name: "Seated Cable Back Extension",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Round", "Reached", "Extend", "Upright"],
  tempo: { lower: 2.2, bottom: 0.25, raise: 1.8, top: 0.4 },
  station: {
    kind: "seated",
    seatZ: -0.02,
    heelZ: 0.46,
    frame: { type: "seated-row", pulleyY: 0.62 },
    feetMode: "floor",
  },
  apparatus: {
    kind: "cable-single",
    skipColumn: true,
    pulley: [0, 0.62, 1.25],
    facingDir: -1,
    attachment: "straight-bar",
    attachmentWidth: 0.7,
    gripX: 0.26,
  },
  stiffness: { lumbar: 2.6, thoracic: 2.4, hip: 6, elbow: 6, neck: 2.4 },
  hints: { start: TALL, end: ROUND },
  checks: () => [
    checkJointRange(
      "lumbar-curl",
      "Lower back rounds and extends",
      "Lean forward by rounding the entire back, then sit up by extending the spine.",
      "lumbar.flex",
      16,
    ),
    checkJointRange(
      "thoracic-curl",
      "Upper back rounds with the lower back",
      "Round the lower, middle, and upper back together so the ribs move toward the hip bones.",
      "thoracic.flex",
      10,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Keep the elbows straight. The back does the work while the arms stay outstretched.",
      "elbow_L.flex",
      "peak",
      0,
      20,
    ),
    checkJointWithinAt(
      "upright-top",
      "Torso finishes upright",
      "Finish with a proud chest and the shoulders stacked over the hips, lower back mildly arched.",
      "lumbar.flex",
      "start",
      -18,
      6,
    ),
    checkJointRange(
      "scapulae",
      "Shoulder blades settle back as the chest rises",
      "A proud-chest finish brings the shoulder blades back as the spine extends.",
      "clavicle_L.prot",
      14,
    ),
    checkNeutralNeck("Round only as far as is comfortable, and keep the neck from cranking.", 18),
  ],
});
