import { Vector3 } from "three";
import { buildExerciseSpec, lockTorsoPitch } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, pin, plantFoot } from "../solver";

/** Bent-knee bench dip on a bench-height box. Feet flat and close, so the hands carry less weight. */
const BOX_TOP = 0.44;

const TRUNK = {
  "root.z": 0.12,
  "root.pitch": -6,
  "hip.flex": 80,
  "hip.abd": 8,
  "hip.rot": 2,
  "knee.flex": 92,
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
  { anchor: "palmFlat_L", bodyweightShare: 0.25, share: 0.25, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
  { anchor: "palmFlat_R", bodyweightShare: 0.25, share: 0.25, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
];

export const spec = buildExerciseSpec({
  id: "bench-dip-with-bent-knees",
  catalogId: "26d5c6f170d880ce8d6de5f381825c85",
  name: "Bench Dip With Bent Knees",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.4, top: 0.35 },
  stiffness: { elbow: 6, shoulder: 1.4, hip: 3, knee: 4, lumbar: 8, ankle: 5 },
  ground: "palmFlat_L",
  station: {
    kind: "pushup",
    handX: 0.2,
    handZ: -0.36,
    plantFeet: false,
    handElevationY: BOX_TOP,
    footX: 0.16,
    footZ: 0.42,
    feetElevationY: 0,
  },
  apparatus: { kind: "none", bodyweightLoads: LOADS },
  hints: {
    start: {
      ...TRUNK,
      "root.y": 0.56,
      "shoulder.elev": 22,
      "shoulder.plane": -14,
      "elbow.flex": 8,
    },
    end: {
      ...TRUNK,
      "root.y": 0.4,
      "root.pitch": -12,
      "hip.flex": 72,
      "knee.flex": 96,
      "shoulder.elev": 46,
      "shoulder.plane": -22,
      "elbow.flex": 96,
    },
  },
  extraGoals: (body) => [
    lockAngle(body, "knee_L.flex", 94, 22),
    lockAngle(body, "knee_R.flex", 94, 22),
    lockAngle(body, "ankle_L.dorsi", 8, 20),
    lockAngle(body, "ankle_R.dorsi", 8, 20),
    lockTorsoPitch(body, -8, 40),
    pin(body, "pelvisBottom", () => new Vector3(0, 0.46, 0.2), 40, "z"),
    ...plantFoot(body, "L", new Vector3(0.16, 0.02, 0.42), 0.1, 48),
    ...plantFoot(body, "R", new Vector3(-0.16, 0.02, 0.42), 0.1, 48),
  ],
  extraKeyGoals: (body) => ({
    start: [
      pin(body, "pelvisBottom", () => new Vector3(0, 0.5, 0.12), 50, "y"),
      lockAngle(body, "shoulder_L.elev", 28, 40),
      lockAngle(body, "shoulder_R.elev", 28, 40),
    ],
    end: [
      pin(body, "pelvisBottom", () => new Vector3(0, 0.38, 0.1), 70, "y"),
      lockAngle(body, "shoulder_L.elev", 48, 48),
      lockAngle(body, "shoulder_R.elev", 48, 48),
      lockAngle(body, "shoulder_L.plane", -12, 30),
      lockAngle(body, "shoulder_R.plane", -12, 30),
    ],
  }),
  checks: () => [
    checkJointWithinAt(
      "elbows-locked",
      "Elbows start straight",
      "Place the palms on the edge of the bench with the arms directed down and the elbows straight.",
      "elbow_L.flex",
      "top",
      0,
      30,
    ),
    checkJointWithinAt(
      "elbows-deep",
      "Elbows bend to about 90 degrees",
      "Bend the elbows close to the sides through the range the shoulders allow.",
      "elbow_L.flex",
      "bottom",
      70,
      125,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows extend to press up",
      "Push through the bases of the palms until the elbows are straight.",
      "elbow_L.flex",
      55,
    ),
    checkJointWithinAt(
      "knees-bent",
      "Knees stay bent near 90 degrees",
      "Keep the feet flat and the knees fairly close to a 90 degree bend.",
      "knee_L.flex",
      "peak",
      70,
      120,
    ),
  ],
});
