import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle, pin } from "../solver";

/** Both hands steady one dumbbell in the hip crease. */
const ARMS = {
  "shoulder.plane": 78,
  "shoulder.twist": 8,
  "elbow.flex": 78,
  "forearm.pron": 40,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-hip-thrust",
  catalogId: "1a35c6f170d8801d8819ce2fc219c047",
  name: "Dumbbell Hip Thrust",
  defaultLoadKg: 12,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Drive", "Lockout", "Lower", "Bottom"],
  tempo: { lower: 1.4, bottom: 0.45, raise: 1.2, top: 0.35 },
  station: { kind: "hip-thrust", stanceX: 0.16, heelZ: 0.5, benchTopY: 0.42 },
  apparatus: { kind: "dumbbells", sides: ["L"] },
  extraContacts: {
    dumbbell_L: { thigh_L: 0.12, thigh_R: 0.1, shank_L: 0.1, pelvis: 0.08, abdomen: 0.1 },
  },
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "hip_L.flex", 75, 40),
      lockAngle(body, "hip_R.flex", 75, 40),
      pin(body, "pelvisFront", () => new Vector3(0, 0.32, 0.2), 36, "yz"),
    ],
    end: [
      lockAngle(body, "hip_L.flex", 4, 48),
      lockAngle(body, "hip_R.flex", 4, 48),
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
      "hip.abd": 8,
      "knee.flex": 100,
      "ankle.dorsi": 6,
      "shoulder.elev": 40,
      "neck.flex": 16,
      "lumbar.flex": 6,
      "thoracic.flex": 4,
    },
    end: {
      ...ARMS,
      "root.y": 0.55,
      "root.z": 0.06,
      "root.pitch": -2,
      "hip.flex": 2,
      "hip.abd": 8,
      "knee.flex": 88,
      "ankle.dorsi": 8,
      "shoulder.elev": 34,
      "elbow.flex": 52,
      "neck.flex": 14,
      "lumbar.flex": 0,
      "thoracic.flex": 0,
    },
  },
  checks: () => [
    checkNeutralNeck(
      "Tuck your chin mildly toward your chest, and maintain this neck position throughout the exercise.",
      28,
    ),
    checkJointRange(
      "hip-drive",
      "Hips extend to a straight line",
      "At the end of the lifting phase, you should be able to draw a straight line from your thighs through your hips to your torso.",
      "hip_L.flex",
      45,
    ),
    checkJointWithinAt(
      "bottom-flex",
      "Hips start flexed",
      "Lower your hips through the range you can reach with hip motion rather than lower-back motion.",
      "hip_L.flex",
      "start",
      45,
      110,
    ),
    checkJointWithinAt(
      "knees-bent",
      "Knees stay bent",
      "Position your feet out in front of you with your soles flat and your knees bent to at least 90 degrees.",
      "knee_L.flex",
      "peak",
      70,
      120,
    ),
    checkJointWithinAt(
      "lockout",
      "Hips reach full extension",
      "Lift your hips by driving your heels into the ground and squeezing your glutes until your thighs and torso align.",
      "hip_L.flex",
      "peak",
      -15,
      25,
    ),
  ],
});
