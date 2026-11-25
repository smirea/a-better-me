import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { pullUpStation } from "../equipment-library";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, pin, plantToe } from "../solver";

const BAR_Y = 2.08;

/** Same scapular hang as the full version, with the forefeet sharing the load. */
const HANG = {
  ...POSTURE_HINTS.hanging,
  "root.y": 1.1,
  "root.z": 0.0,
  "root.pitch": 0,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 6,
  "hip.flex": 8,
  "hip.abd": 4,
  "knee.flex": 18,
  "ankle.dorsi": -16,
  "shoulder.elev": 140,
  "shoulder.plane": 42,
  "shoulder.twist": -14,
  "elbow.flex": 8,
  "forearm.pron": 76,
  "wrist.flex": 10,
  "clavicle.prot": 0,
};

export const spec = buildExerciseSpec({
  id: "regressed-scapular-pull-up-feet-on-floor",
  catalogId: "1b45c6f170d880b690e9ea8e742a0167",
  name: "Regressed Scapular Pull-Up (Feet On Floor)",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  brace: true,
  cameraHint: { view: "Front" },
  phaseLabels: ["Depress", "Packed", "Release", "Shrugged"],
  tempo: { lower: 1.1, bottom: 0.35, raise: 1.2, top: 0.3 },
  station: { kind: "cardio", machine: "none" },
  extraEquipment: pullUpStation(BAR_Y, 0, 1.2).parts,
  extraContacts: { "pullup.bar": { hand_L: 0.07, hand_R: 0.07, forearm_L: 0.04, forearm_R: 0.04 } },
  extraGoals: (body) => [
    pin(body, "grip_L", () => new Vector3(0.22, BAR_Y, 0), 52),
    pin(body, "grip_R", () => new Vector3(-0.22, BAR_Y, 0), 52),
    ...plantToe(body, "L", new Vector3(0.12, 0.03, -0.02), 0.1, 8),
    ...plantToe(body, "R", new Vector3(-0.12, 0.03, -0.02), 0.1, 8),
    lockAngle(body, "elbow_L.flex", 8, 16),
    lockAngle(body, "elbow_R.flex", 8, 16),
  ],
  ground: "grip_L",
  extraRequired: [
    { label: "Left hand on bar", anchor: "grip_L", part: "pullup.bar", allowSlide: true },
    { label: "Right hand on bar", anchor: "grip_R", part: "pullup.bar", allowSlide: true },
    { label: "Left forefoot on floor", anchor: "ballIn_L", surfaceY: 0.02, allowSlide: true },
    { label: "Right forefoot on floor", anchor: "ballIn_R", surfaceY: 0.02, allowSlide: true },
  ],
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "grip_L", bodyweightShare: 0.12, grip: "hang", direction: [0, 1, 0] },
      { anchor: "grip_R", bodyweightShare: 0.12, grip: "hang", direction: [0, 1, 0] },
    ],
  },
  stiffness: { shoulder: 8, elbow: 10, wrist: 6, clavicle: 0.35, ankle: 3, knee: 3, thoracic: 12, lumbar: 8 },
  hints: {
    start: { ...HANG, "clavicle.elev": 18, "root.y": 1.06 },
    end: { ...HANG, "clavicle.elev": -4, "root.y": 1.14 },
  },
  checks: () => [
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Keep the elbows straight while part of each foot stays on the ground.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "heels-up",
      "Heels lift, forefeet stay down",
      "Bend the knees enough to lift the heels while the balls of the feet and the toes stay down.",
      "ankle_L.dorsi",
      "top",
      -40,
      -4,
    ),
    checkJointWithinAt(
      "shrugged",
      "Shoulders start shrugged",
      "Let the shoulders rise toward the ears before you depress the shoulder blades.",
      "clavicle_L.elev",
      "top",
      2,
      42,
    ),
    checkJointRange(
      "scapular-depression",
      "Shoulder blades depress with the feet assisting",
      "Pack the armpits down. Shift more weight into the feet if the hang is too hard.",
      "clavicle_L.elev",
      6,
    ),
  ],
});
