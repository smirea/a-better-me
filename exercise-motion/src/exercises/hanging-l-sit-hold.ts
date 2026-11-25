import { Vector3 } from "three";
import { sideSign } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { pullUpStation } from "../equipment-library";
import { checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/** Dead hang with the legs held straight out so the body reads as an L. */
const HOLD = {
  ...POSTURE_HINTS.hanging,
  "root.y": 1.28,
  "root.z": 0.02,
  "root.pitch": 2,
  "lumbar.flex": 14,
  "thoracic.flex": 6,
  "neck.flex": 4,
  "hip.flex": 90,
  "hip.abd": 8,
  "knee.flex": 18,
  "ankle.dorsi": 4,
  "clavicle.elev": -4,
  "shoulder.elev": 168,
  "shoulder.plane": 8,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 75,
  "wrist.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "hanging-l-sit-hold",
  catalogId: "2a05c6f170d880a5a708e2c30cb4a5a2",
  name: "Hanging L-Sit Hold",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  isometric: true,
  brace: true,
  phaseLabels: ["Hang", "Raise", "Hold", "Hold"],
  station: { kind: "cardio", machine: "none" },
  // The hanging station marks the hips passive, so the leg lever is dumped onto the spine.
  extraEquipment: pullUpStation(2.2, 0, 1.2).parts,
  extraContacts: { "pullup.bar": { hand_L: 0.07, hand_R: 0.07, forearm_L: 0.04, forearm_R: 0.04 } },
  extraRequired: [
    { label: "Left hand on bar", anchor: "grip_L", part: "pullup.bar", allowSlide: true },
    { label: "Right hand on bar", anchor: "grip_R", part: "pullup.bar", allowSlide: true },
  ],
  extraGoals: (body) => [
    pin(body, "grip_L", () => new Vector3(sideSign("L") * 0.28, 2.2, 0), 56),
    pin(body, "grip_R", () => new Vector3(sideSign("R") * 0.28, 2.2, 0), 56),
  ],
  ground: "grip_L",
  apparatus: { kind: "none" },
  stiffness: { hip: 8, knee: 8, shoulder: 8, lumbar: 10 },
  hints: { start: HOLD, end: HOLD },
  checks: () => [
    checkJointWithinAt(
      "legs-parallel",
      "Legs hold about parallel to the ground",
      "Sweep your legs up and out in front of you, keeping your knees straight, until your legs are approximately parallel to the ground.",
      "hip_L.flex",
      "start",
      70,
      115,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Knees stay straight",
      "Keep your knees straight so your torso and legs resemble an L when viewed from the side.",
      "knee_L.flex",
      "start",
      0,
      35,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Keep your torso vertical and your elbows straight as you avoid swinging.",
      "elbow_L.flex",
      "start",
      0,
      22,
    ),
    checkJointWithinAt(
      "shoulders-down",
      "Shoulder blades stay pulled down",
      "Pull your shoulder blades down so your shoulders stay away from your ears.",
      "clavicle_L.elev",
      "start",
      -12,
      12,
    ),
  ],
});
