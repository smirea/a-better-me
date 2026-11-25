import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle, mirrored, pin } from "../solver";

const ARMS = {
  "shoulder.plane": 78,
  "shoulder.twist": 8,
  "elbow.flex": 72,
  "forearm.pron": 40,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "single-leg-dumbbell-hip-thrust",
  catalogId: "2a15c6f170d880c18cd3d6a4c77b1ce3",
  name: "Single Leg Dumbbell Hip Thrust",
  defaultLoadKg: 12,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Drive", "Lockout", "Lower", "Bottom"],
  tempo: { lower: 1.4, bottom: 0.4, raise: 1.2, top: 0.35 },
  station: { kind: "hip-thrust", stanceX: 0.14, heelZ: 0.48, benchTopY: 0.42 },
  apparatus: { kind: "dumbbells", sides: ["L"] },
  extraContacts: {
    dumbbell_L: { thigh_L: 0.12, thigh_R: 0.08, shank_L: 0.1, pelvis: 0.06 },
  },
  extraGoals: (body) => [mirrored(body, 8)],
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "hip_L.flex", 72, 40),
      lockAngle(body, "hip_R.flex", 72, 40),
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
    },
  },
  checks: () => [
    checkNeutralNeck(
      "Tuck your chin mildly toward your chest, and keep that neck position throughout the exercise.",
      28,
    ),
    checkJointRange(
      "hip-drive",
      "Working hip extends to a straight line",
      "At the top, draw a straight line from the working thigh through the hip to the shoulder.",
      "hip_L.flex",
      42,
    ),
    checkJointWithinAt(
      "bottom-flex",
      "Working hip starts flexed",
      "Lower through the hip range you can reach without rounding or excessively arching your lower back.",
      "hip_L.flex",
      "start",
      45,
      110,
    ),
    checkJointWithinAt(
      "knee-angle",
      "Working knee stays near a right angle",
      "Place the working foot so the knee is about 90 degrees at the top of the thrust.",
      "knee_L.flex",
      "peak",
      65,
      115,
    ),
    checkJointWithinAt(
      "lockout",
      "Working hip reaches extension",
      "Drive the working heel down and squeeze the glute until the thigh and torso line up, with the hip bones level.",
      "hip_L.flex",
      "peak",
      -15,
      24,
    ),
  ],
});
