import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { flatBench } from "../equipment";
import { checkAnchorTravel, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { pin } from "../solver";

/** Same shoulder pivot as a dragon flag. Knees stay bent so the lever is shorter. */
const BENCH_Y = 0.5;
const BENCH = flatBench({ topY: BENCH_Y, zHead: -0.28, zFoot: 0.28 });

const GRIP = {
  "shoulder.elev": 156,
  "shoulder.plane": 70,
  "shoulder.twist": 16,
  "elbow.flex": 80,
  "forearm.pron": 70,
  "wrist.flex": 8,
  "clavicle.elev": -4,
};

const LOW = {
  "root.y": 0.64,
  "root.z": 0.22,
  "root.pitch": -76,
  "lumbar.flex": 14,
  "thoracic.flex": 6,
  "neck.flex": 6,
  "hip.flex": 16,
  "hip.abd": 6,
  "knee.flex": 96,
  "ankle.dorsi": 0,
  ...GRIP,
};

const HIGH = {
  ...LOW,
  "root.y": 1.02,
  "root.z": 0.0,
  "root.pitch": -130,
  "lumbar.flex": 18,
  "hip.flex": 20,
  "knee.flex": 98,
};

export const spec = buildExerciseSpec({
  id: "bent-knee-dragon-flag",
  catalogId: "2e85c6f170d88074a8fef350923d4e8e",
  name: "Bent-Knee Dragon Flag",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  brace: true,
  phaseLabels: ["Lower", "Hover", "Raise", "Vertical"],
  ground: "upperBack",
  station: { kind: "cardio", machine: "none" },
  extraEquipment: BENCH,
  extraContacts: {
    "bench.pad": { chest: 0.05, girdle: 0.04, head: 0.04, abdomen: 0.03, hand_L: 0.07, hand_R: 0.07 },
  },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 18, thoracic: 14, hip: 6, knee: 5, shoulder: 3, elbow: 4 },
  extraGoals: (body) => [
    pin(body, "upperBack", () => new Vector3(0, BENCH_Y - 0.02, -0.05), 56, "xy"),
    pin(body, "occiput", () => new Vector3(0, BENCH_Y + 0.02, -0.42), 22, "y"),
    pin(body, "grip_L", () => new Vector3(0.2, BENCH_Y - 0.06, -0.32), 28),
    pin(body, "grip_R", () => new Vector3(-0.2, BENCH_Y - 0.06, -0.32), 28),
  ],
  hints: { start: LOW, end: HIGH },
  checks: () => [
    checkAnchorTravel(
      "body-rises",
      "The tucked body rises toward vertical",
      "Raise and lower the body from the shoulders with the knees bent, keeping the hips extended so the thighs stay in line with the torso.",
      "kneeFront_L",
      "y",
      0.18,
    ),
    checkJointWithinAt(
      "knees-bent",
      "Knees stay bent",
      "Bend the knees about 90 degrees and keep them there. The shorter lever is the difference from a straight-leg dragon flag.",
      "knee_L.flex",
      "peak",
      75,
      120,
    ),
    checkJointWithinAt(
      "hips-extended",
      "Hips stay extended",
      "Do not curl the knees toward the chest. The bend stays at the knees while the torso and thighs move as one piece.",
      "hip_L.flex",
      "peak",
      0,
      40,
    ),
    checkJointWithinAt(
      "ribs-down",
      "Ribs stay pulled down",
      "Brace the abs so the lower back does not hyperextend while the shoulders stay on the bench.",
      "lumbar.flex",
      "start",
      0,
      32,
    ),
    checkNeutralNeck("Keep the neck quiet against the bench rather than craning to watch the knees.", 32),
  ],
});
