import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle, pin } from "../solver";

/** Arms folded across the chest. The band between the outer thighs is the load. */
const ARMS = {
  "shoulder.elev": 28,
  "shoulder.plane": -24,
  "shoulder.twist": -20,
  "elbow.flex": 118,
  "forearm.pron": 30,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "thigh-banded-bodyweight-hip-thrust",
  catalogId: "1a35c6f170d880d4b873c7916f5eb3c9",
  name: "Thigh-Banded Bodyweight Hip Thrust",
  defaultLoadKg: 3,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Drive", "Lockout", "Lower", "Bottom"],
  tempo: { lower: 1.4, bottom: 0.4, raise: 1.2, top: 0.35 },
  station: { kind: "hip-thrust", stanceX: 0.2, heelZ: 0.5, benchTopY: 0.42 },
  apparatus: {
    kind: "band",
    anchors: [
      [0.24, 0.46, 0.4],
      [-0.24, 0.46, 0.4],
    ],
    targetAnchors: ["thighOuter_L", "thighOuter_R"],
  },
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "hip_L.flex", 75, 40),
      lockAngle(body, "hip_R.flex", 75, 40),
      lockAngle(body, "hip_L.abd", 16, 18),
      lockAngle(body, "hip_R.abd", 16, 18),
      pin(body, "pelvisFront", () => new Vector3(0, 0.32, 0.2), 36, "yz"),
    ],
    end: [
      lockAngle(body, "hip_L.flex", 4, 48),
      lockAngle(body, "hip_R.flex", 4, 48),
      lockAngle(body, "hip_L.abd", 18, 18),
      lockAngle(body, "hip_R.abd", 18, 18),
      lockAngle(body, "knee_L.flex", 90, 24),
      lockAngle(body, "knee_R.flex", 90, 24),
      pin(body, "pelvisFront", () => new Vector3(0, 0.42, 0.14), 48, "yz"),
    ],
  }),
  hints: {
    start: {
      ...ARMS,
      "root.y": 0.4,
      "root.z": 0.02,
      "root.pitch": -32,
      "hip.flex": 72,
      "hip.abd": 16,
      "hip.rot": 8,
      "knee.flex": 100,
      "ankle.dorsi": 6,
      "neck.flex": 8,
      "lumbar.flex": 6,
      "thoracic.flex": 4,
    },
    end: {
      ...ARMS,
      "root.y": 0.55,
      "root.z": 0.06,
      "root.pitch": -2,
      "hip.flex": 2,
      "hip.abd": 18,
      "hip.rot": 10,
      "knee.flex": 88,
      "ankle.dorsi": 8,
      "neck.flex": 6,
      "lumbar.flex": 0,
      "thoracic.flex": 0,
    },
  },
  checks: () => [
    checkNeutralNeck(
      "Keep your neck near a neutral position, like when you are standing upright and looking straight ahead.",
      22,
    ),
    checkJointRange(
      "hip-drive",
      "Hips extend to a straight line",
      "At the top, draw a straight line from your thighs through your hips to your torso.",
      "hip_L.flex",
      45,
    ),
    checkJointWithinAt(
      "knees-out",
      "Knees push out against the band",
      "Push your knees out in line with your feet and keep them there against the band.",
      "hip_L.abd",
      "peak",
      8,
      36,
    ),
    checkJointWithinAt(
      "knees-bent",
      "Knees stay bent",
      "Set your feet so the knees are bent to at least 90 degrees, with the soles flat.",
      "knee_L.flex",
      "peak",
      70,
      120,
    ),
    checkJointWithinAt(
      "lockout",
      "Hips reach full extension",
      "Drive your heels down and squeeze your glutes until your thighs and torso align.",
      "hip_L.flex",
      "peak",
      -15,
      24,
    ),
  ],
});
