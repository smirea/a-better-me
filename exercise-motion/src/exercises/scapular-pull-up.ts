import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Dead hang. Elbows stay straight while the shoulder blades depress and elevate. */
const HANG = {
  ...POSTURE_HINTS.hanging,
  "root.y": 1.28,
  "root.z": 0,
  "root.pitch": 1,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 6,
  "hip.flex": 14,
  "hip.abd": 6,
  "knee.flex": 48,
  "ankle.dorsi": 8,
  "shoulder.elev": 168,
  "shoulder.plane": 16,
  "shoulder.twist": -14,
  "elbow.flex": 6,
  "forearm.pron": 76,
  "wrist.flex": 10,
  "clavicle.prot": 2,
};

export const spec = buildExerciseSpec({
  id: "scapular-pull-up",
  catalogId: "1a15c6f170d880cdb451e459ddf41d2a",
  name: "Scapular Pull-Up",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  brace: true,
  cameraHint: { view: "Front" },
  phaseLabels: ["Depress", "Packed", "Release", "Shrugged"],
  tempo: { lower: 1.1, bottom: 0.35, raise: 1.2, top: 0.3 },
  station: { kind: "hanging", barY: 2.28 },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "grip_L", bodyweightShare: 0.5, grip: "hang", direction: [0, 1, 0] },
      { anchor: "grip_R", bodyweightShare: 0.5, grip: "hang", direction: [0, 1, 0] },
    ],
  },
  stiffness: { shoulder: 8, elbow: 10, wrist: 6, clavicle: 0.35, lumbar: 6 },
  extraGoals: (body) => [lockAngle(body, "elbow_L.flex", 8, 16), lockAngle(body, "elbow_R.flex", 8, 16)],
  hints: {
    start: { ...HANG, "clavicle.elev": 16, "root.y": 1.24 },
    end: { ...HANG, "clavicle.elev": -10, "root.y": 1.32 },
  },
  checks: () => [
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Hang with straight elbows. The pull is the shoulder blades, not a pull-up.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip",
      "Grasp the bar palms forward, near shoulder width or a little wider.",
      "forearm_L.pron",
      "top",
      50,
      90,
    ),
    checkJointWithinAt(
      "shrugged",
      "Shoulders start near the ears",
      "Begin from a hang that looks like a shrug, shoulders up toward the ears.",
      "clavicle_L.elev",
      "top",
      6,
      28,
    ),
    checkJointRange(
      "scapular-depression",
      "Shoulder blades depress while the elbows stay straight",
      "Pack the armpits down into the pockets. The body rises a little, then lowers as the shoulders shrug back up.",
      "clavicle_L.elev",
      12,
    ),
  ],
});
