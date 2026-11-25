import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { platformBox } from "../equipment-library";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/** Back against a wall, feet walked forward, knees straight. */
const LEAN = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.9,
  "root.z": 0.18,
  "root.pitch": -24,
  "hip.flex": 10,
  "hip.abd": 6,
  "knee.flex": 4,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 8,
  "shoulder.elev": 12,
  "shoulder.plane": 20,
  "elbow.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "standing-tib-raise",
  catalogId: "1a15c6f170d8801383bce169e240d03c",
  name: "Standing Tib Raise",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Lift", "Toes up", "Lower", "Soles down"],
  tempo: { lower: 1.4, bottom: 0.25, raise: 1.3, top: 0.3 },
  station: { kind: "cardio", machine: "none" },
  extraEquipment: platformBox("wall", [0, 0, -0.32], 0.36, 1.45, 0.08, "steel"),
  extraGoals: (body) => [
    pin(body, "heel_L", () => new Vector3(0.12, 0, 0.32), 56),
    pin(body, "heel_R", () => new Vector3(-0.12, 0, 0.32), 56),
    pin(body, "upperBack", () => new Vector3(0, 1.12, -0.22), 26, "z"),
    pin(body, "sacrum", () => new Vector3(0, 0.82, -0.22), 22, "z"),
  ],
  extraRequired: [
    { label: "Left heel on the floor", anchor: "heel_L", surfaceY: 0, allowSlide: true },
    { label: "Right heel on the floor", anchor: "heel_R", surfaceY: 0, allowSlide: true },
  ],
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "ballIn_L", bodyweightShare: 0.12, grip: "rest", direction: [0, -1, 0] },
      { anchor: "ballIn_R", bodyweightShare: 0.12, grip: "rest", direction: [0, -1, 0] },
    ],
  },
  stiffness: { ankle: 8, knee: 10, hip: 4 },
  hints: {
    start: { ...LEAN, "ankle.dorsi": 2 },
    end: { ...LEAN, "ankle.dorsi": 30 },
  },
  checks: () => [
    checkJointWithinAt(
      "heels-down",
      "Heels stay on the floor",
      "While keeping your heels on the ground, lift the rest of your feet off the ground.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Knees stay straight against the wall",
      "Keep your knees straight while your buttocks and back remain in contact with the wall.",
      "knee_L.flex",
      "start",
      0,
      16,
    ),
    checkJointRange(
      "ankle-dorsiflexion",
      "Ankles dorsiflex",
      "Lift the balls of your feet through your available ankle range, the opposite of a calf raise.",
      "ankle_L.dorsi",
      16,
    ),
    checkJointWithinAt(
      "toes-up",
      "Forefeet finish lifted",
      "Finish with the balls of the feet lifted and only the heels on the ground.",
      "ankle_L.dorsi",
      "peak",
      16,
      36,
    ),
  ],
});
