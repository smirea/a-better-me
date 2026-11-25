import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Seated on the floor in front of a low rope. The pull finishes at eye level in a T. */
const REACH = {
  "shoulder.elev": 70,
  "shoulder.plane": 80,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 72,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": 12,
};

const PULL = {
  "shoulder.elev": 86,
  "shoulder.plane": 14,
  "shoulder.twist": -54,
  "elbow.flex": 100,
  "forearm.pron": -24,
  "wrist.flex": 0,
  "clavicle.elev": 10,
  "clavicle.prot": -16,
};

const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.12,
  "root.pitch": 2,
  "hip.flex": 78,
  "knee.flex": 48,
  "ankle.dorsi": 8,
  "lumbar.flex": 4,
  "thoracic.flex": -2,
  "neck.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "seated-cable-face-pull",
  catalogId: "2a15c6f170d88066bc8ad397f7884a40",
  name: "Seated Cable Face Pull",
  defaultLoadKg: 10,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Face", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.08,
    seatZ: 0,
    heelZ: 0.55,
    frame: { type: "box", height: 0.06 },
    feetMode: "floor",
    leanDeg: 2,
  },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 0.28, 1.15],
    columnPos: [0, 1.28],
    facingDir: -1,
    attachment: "rope",
    attachmentWidth: 1.2,
    freeGripWidth: true,
  },
  stiffness: { elbow: 1.6, shoulder: 0.85, lumbar: 8, hip: 4, knee: 3 },
  progress: (body, frame) => -anchorPoint(body, frame, "grip_L").z,
  hints: {
    start: { ...SEAT, ...REACH },
    end: { ...SEAT, ...PULL },
  },
  checks: () => [
    checkFlatBack(
      "Sit upright on the floor with the feet against the station. The torso stays tall while the arms pull.",
    ),
    checkNeutralNeck("Keep the chest up and the neck quiet as the rope reaches the face."),
    checkJointRange(
      "elbow-bend",
      "Elbows bend as the rope comes to the face",
      "Pull the rope backward and upward until the middle of the rope is near eye level.",
      "elbow_L.flex",
      55,
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms start stretched toward the low cable",
      "Start with the elbows straightened and the arms stretched out in front of you.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "t-shape",
      "Upper arms finish in a T",
      "Finish with the upper arms about parallel with the ground, forming a T with the torso.",
      "shoulder_L.plane",
      "bottom",
      -8,
      38,
    ),
    checkJointWithinAt(
      "external-rotation",
      "Hands finish beside the shoulders",
      "Each elbow finishes a little past 90 degrees, with the arms in a double-biceps pose and the palms toward the shoulders.",
      "shoulder_L.twist",
      "bottom",
      -90,
      -20,
    ),
  ],
});
