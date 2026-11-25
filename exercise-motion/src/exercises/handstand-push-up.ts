import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { keepAbove, lockAngle, pin } from "../solver";

/**
 * Freestanding handstand push-up: body inverted, palms fixed on the floor,
 * elbows bending so the head travels toward the floor and then pressing back to a lockout.
 */
const INVERTED = {
  "root.x": 0,
  "root.z": 0.02,
  "root.pitch": 176,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 8,
  "hip.flex": 8,
  "hip.abd": 6,
  "knee.flex": 6,
  "ankle.dorsi": -8,
  "shoulder.plane": 48,
  "shoulder.twist": 8,
  "forearm.pron": 70,
  "wrist.flex": -36,
};

const LOADS = [
  { anchor: "palmFlat_L", bodyweightShare: 0.475, share: 0.475, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
  { anchor: "palmFlat_R", bodyweightShare: 0.475, share: 0.475, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
];

export const spec = buildExerciseSpec({
  id: "handstand-push-up",
  catalogId: "1a15c6f170d880d392eae0869b5c9355",
  name: "Handstand Push-Up",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Lower", "Head down", "Press", "Lockout"],
  tempo: { lower: 1.6, bottom: 0.2, raise: 1.4, top: 0.35 },
  station: { kind: "cardio", machine: "none" },
  ground: "palmFlat_L",
  stiffness: { elbow: 40, shoulder: 6, hip: 10, knee: 10, lumbar: 8 },
  apparatus: { kind: "none", bodyweightLoads: LOADS },
  extraGoals: (body) => [
    pin(body, "palmFlat_L", () => new Vector3(0.28, 0.08, 0.12), 80),
    pin(body, "palmFlat_R", () => new Vector3(-0.28, 0.08, 0.12), 80),
    keepAbove(body, "occiput", 0.1, 48),
    lockAngle(body, "hip_L.flex", 8, 28),
    lockAngle(body, "hip_R.flex", 8, 28),
    lockAngle(body, "knee_L.flex", 6, 24),
    lockAngle(body, "knee_R.flex", 6, 24),
  ],
  extraKeyGoals: (body) => ({
    start: [lockAngle(body, "elbow_L.flex", 8, 280), lockAngle(body, "elbow_R.flex", 8, 280)],
    end: [lockAngle(body, "elbow_L.flex", 82, 220), lockAngle(body, "elbow_R.flex", 82, 220)],
  }),
  hints: {
    start: {
      ...INVERTED,
      "root.y": 1.12,
      "shoulder.elev": 168,
      "elbow.flex": 8,
      "clavicle.elev": 16,
      "clavicle.prot": 2,
    },
    end: {
      ...INVERTED,
      "root.y": 0.98,
      "shoulder.elev": 136,
      "elbow.flex": 82,
      "clavicle.elev": 8,
      "clavicle.prot": -2,
    },
  },
  checks: () => [
    checkJointWithinAt(
      "elbows-locked",
      "Elbows lock out overhead",
      "At the top the elbows are straight and the arms are locked, with the body stacked over the hands.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "head-lowers",
      "Elbows bend as the head lowers",
      "Bend the elbows and lower the head toward the floor between the hands, stopping before the head crashes down.",
      "elbow_L.flex",
      "bottom",
      60,
      110,
    ),
    checkJointRange(
      "elbow-rom",
      "Press from bent elbows to a lockout",
      "Press the body upward from bent elbows until the arms are locked overhead.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "shoulders-flexed",
      "Shoulders stay flexed",
      "The press is shoulder flexion. Keep the hands under the shoulders and the body inverted the whole rep.",
      "shoulder_L.elev",
      "peak",
      100,
      175,
    ),
    checkJointWithinAt(
      "body-straight",
      "Hips and knees stay extended",
      "Keep the hips and knees nearly straight so the inverted body moves as one line from hands to feet.",
      "knee_L.flex",
      "peak",
      0,
      24,
    ),
  ],
});
