import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { lockAngle, pin } from "../solver";
import { Vector3 } from "three";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Seated lat pulldown. Elbows stay straight; only the shoulder blades depress. */
const SEAT = {
  ...POSTURE_HINTS.seatedLeanBack,
  "root.y": 0.48,
  "root.pitch": -4,
  "hip.flex": 84,
  "knee.flex": 92,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 4,
  "shoulder.elev": 158,
  "shoulder.plane": 62,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 72,
  "wrist.flex": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "scapular-pulldown",
  catalogId: "32d5c6f170d880fc9128daed81e228d0",
  name: "Scapular Pulldown",
  defaultLoadKg: 25,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Front" },
  phaseLabels: ["Depress", "Packed", "Release", "Shrugged"],
  tempo: { lower: 1.2, bottom: 0.35, raise: 1.3, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.44,
    seatZ: -0.02,
    stanceX: 0.16,
    heelZ: 0.34,
    leanDeg: -4,
    frame: { type: "lat-pulldown", thighPadY: 0.62, pulleyZ: 0.16 },
  },
  apparatus: {
    kind: "cable-single",
    skipColumn: true,
    pulley: [0, 2.18, 0.16],
    facingDir: -1,
    attachment: "lat-bar",
    attachmentWidth: 0.92,
    gripX: 0.32,
    handPath: { startY: 1.78, startZ: 0.12, endY: 1.58, endZ: 0.1 },
  },
  stiffness: { elbow: 12, shoulder: 6, clavicle: 0.4, lumbar: 8 },
  extraGoals: (body) => [
    pin(body, "pelvisBottom", () => new Vector3(0, 0.43, -0.02), 80),
    lockAngle(body, "elbow_L.flex", 8, 18),
    lockAngle(body, "elbow_R.flex", 8, 18),
  ],
  hints: {
    start: { ...SEAT, "clavicle.elev": 18 },
    end: { ...SEAT, "clavicle.elev": -12 },
  },
  checks: () => [
    checkFlatBack("Stay upright on the seat. The torso does not lean back to move the bar.", 10),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Let the elbows straighten as you sit, and keep them straight for every rep.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip outside the shoulders",
      "Grasp the bar slightly outside shoulder width, palms forward, bar in the base of the fingers.",
      "forearm_L.pron",
      "top",
      50,
      90,
    ),
    checkJointWithinAt(
      "shrugged",
      "Shoulders start shrugged toward the ears",
      "The cable pulls the shoulder blades up in line with the stack before you depress.",
      "clavicle_L.elev",
      "top",
      6,
      28,
    ),
    checkJointRange(
      "scapular-depression",
      "Shoulder blades depress with straight arms",
      "Pack the armpits down into the pockets, a short range, then let the shoulders shrug back up.",
      "clavicle_L.elev",
      12,
    ),
  ],
});
