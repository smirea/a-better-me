import { Vector3 } from "three";
import { buildExerciseSpec, lockTorsoPitch } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, pin, plantFoot } from "../solver";

/**
 * Straight-knee bench dip on a box the height of a flat bench.
 * Hands are on the near edge, behind the hips. Heels stay on the floor.
 * A supported station keeps the closed chain from being judged as a standing balance.
 */
const TRUNK = {
  "root.z": 0.18,
  "root.pitch": -8,
  "hip.flex": 18,
  "hip.abd": 8,
  "hip.rot": 2,
  "knee.flex": 8,
  "ankle.dorsi": 8,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 4,
  "clavicle.prot": -4,
  "clavicle.elev": -2,
  "forearm.pron": 70,
  "wrist.flex": -12,
  "shoulder.twist": 4,
};

const LOADS = [
  { anchor: "palmFlat_L", bodyweightShare: 0.34, share: 0.34, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
  { anchor: "palmFlat_R", bodyweightShare: 0.34, share: 0.34, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
];

export const spec = buildExerciseSpec({
  id: "bench-dip",
  catalogId: "1a15c6f170d8806f8280ccf956dc3e30",
  name: "Bench Dip",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.4, top: 0.35 },
  stiffness: { elbow: 6, shoulder: 1.4, hip: 4, knee: 10, lumbar: 8, ankle: 6 },
  ground: "palmFlat_L",
  station: {
    kind: "pushup",
    handX: 0.2,
    handZ: -0.34,
    plantFeet: false,
    handElevationY: 0.5,
    footX: 0.14,
    footZ: 0.78,
    feetElevationY: 0,
  },
  apparatus: { kind: "none", bodyweightLoads: LOADS },
  hints: {
    start: {
      ...TRUNK,
      "root.y": 0.72,
      "shoulder.elev": 24,
      "shoulder.plane": -16,
      "elbow.flex": 8,
    },
    end: {
      ...TRUNK,
      "root.y": 0.58,
      "root.pitch": -14,
      "hip.flex": 22,
      "shoulder.elev": 52,
      "shoulder.plane": -28,
      "elbow.flex": 96,
    },
  },
  extraGoals: (body) => [
    lockAngle(body, "knee_L.flex", 8, 40),
    lockAngle(body, "knee_R.flex", 8, 40),
    lockAngle(body, "ankle_L.dorsi", 8, 22),
    lockAngle(body, "ankle_R.dorsi", 8, 22),
    lockTorsoPitch(body, -10, 36),
    pin(body, "pelvisBottom", () => new Vector3(0, 0.66, 0.2), 24, "z"),
    pin(body, "palmFlat_L", () => new Vector3(0.2, 0.5, -0.34), 110),
    pin(body, "palmFlat_R", () => new Vector3(-0.2, 0.5, -0.34), 110),
    ...plantFoot(body, "L", new Vector3(0.14, 0.08, 0.78), 0.08, 96),
    ...plantFoot(body, "R", new Vector3(-0.14, 0.08, 0.78), 0.08, 96),
  ],
  extraKeyGoals: (body) => ({
    start: [
      pin(body, "pelvisBottom", () => new Vector3(0, 0.68, 0.18), 70, "y"),
      lockAngle(body, "elbow_L.flex", 10, 30),
      lockAngle(body, "elbow_R.flex", 10, 30),
    ],
    end: [
      pin(body, "pelvisBottom", () => new Vector3(0, 0.58, 0.16), 55, "y"),
      lockAngle(body, "elbow_L.flex", 88, 40),
      lockAngle(body, "elbow_R.flex", 88, 40),
      lockAngle(body, "shoulder_L.elev", 50, 46),
      lockAngle(body, "shoulder_R.elev", 50, 46),
      lockAngle(body, "shoulder_L.plane", -16, 28),
      lockAngle(body, "shoulder_R.plane", -16, 28),
    ],
  }),
  checks: () => [
    checkJointWithinAt(
      "elbows-locked",
      "Elbows start straight",
      "Support yourself on the edge of the bench with the arms directed down and the elbows straight.",
      "elbow_L.flex",
      "top",
      0,
      30,
    ),
    checkJointWithinAt(
      "elbows-deep",
      "Elbows bend to about 90 degrees",
      "Bend the elbows, tucked close to the sides, through the range the shoulders allow.",
      "elbow_L.flex",
      "bottom",
      55,
      125,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows extend to press up",
      "Push through the bases of the palms until the elbows are straight again.",
      "elbow_L.flex",
      55,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Knees stay straight",
      "Position the legs out in front with straight knees and the heels on the ground.",
      "knee_L.flex",
      "peak",
      0,
      24,
    ),
  ],
});
