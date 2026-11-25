import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/**
 * Seated cable row used as a scapular shrug: elbows stay straight.
 * The bar only travels the distance the shoulder blades retract.
 */
const ARMS = {
  "shoulder.elev": 78,
  "shoulder.plane": 72,
  "shoulder.twist": 14,
  "elbow.flex": 8,
  "forearm.pron": 74,
  "wrist.flex": 4,
  "clavicle.elev": 4,
};

const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 4,
  "hip.flex": 86,
  "knee.flex": 55,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "seated-cable-kelso-shrug",
  catalogId: "2e85c6f170d880b985c1f976e4ade790",
  name: "Seated Cable Kelso Shrug",
  defaultLoadKg: 20,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Retract", "Pinch", "Release", "Stretch"],
  tempo: { lower: 1.5, bottom: 0.35, raise: 1.6, top: 0.3 },
  station: {
    kind: "seated",
    seatZ: -0.02,
    heelZ: 0.42,
    frame: { type: "seated-row", pulleyY: 0.95 },
    feetMode: "floor",
    leanDeg: 4,
  },
  apparatus: {
    kind: "cable-single",
    skipColumn: true,
    pulley: [0, 0.95, 1.25],
    facingDir: -1,
    attachment: "lat-bar",
    attachmentWidth: 0.8,
    gripX: 0.28,
  },
  stiffness: { elbow: 8, shoulder: 2.6, lumbar: 8, clavicle: 0.7 },
  hints: {
    start: { ...SEAT, ...ARMS, "clavicle.prot": 16 },
    end: { ...SEAT, ...ARMS, "shoulder.elev": 74, "clavicle.prot": -18 },
  },
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "elbow_L.flex", 8, 40),
      lockAngle(body, "elbow_R.flex", 8, 40),
      lockAngle(body, "clavicle_L.prot", 16, 36),
      lockAngle(body, "clavicle_R.prot", 16, 36),
    ],
    end: [
      lockAngle(body, "elbow_L.flex", 8, 40),
      lockAngle(body, "elbow_R.flex", 8, 40),
      lockAngle(body, "clavicle_L.prot", -18, 36),
      lockAngle(body, "clavicle_R.prot", -18, 36),
    ],
  }),
  checks: () => [
    checkFlatBack(
      "Sit upright. Do not lean the torso back or round the lower back. Only the shoulder blades move.",
    ),
    checkNeutralNeck("Keep the neck quiet while the shoulder blades slide."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay extended",
      "Without bending the elbows, pull the shoulder blades backward and in toward each other.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "protracted",
      "Shoulder blades start spread forward",
      "Let the shoulder blades move forward and spread apart, past a normal resting posture.",
      "clavicle_L.prot",
      "top",
      6,
      28,
    ),
    checkJointWithinAt(
      "retracted",
      "Shoulder blades pinch together",
      "Pinch the shoulder blades together as if holding a pencil between them. The bar only moves a short distance.",
      "clavicle_L.prot",
      "bottom",
      -30,
      -8,
    ),
    checkJointRange(
      "scapular-retraction",
      "Shoulder blades travel from stretch to pinch",
      "Alternate between a full spread of the shoulder blades and a full pinch, with the arms staying long.",
      "clavicle_L.prot",
      18,
    ),
  ],
});
