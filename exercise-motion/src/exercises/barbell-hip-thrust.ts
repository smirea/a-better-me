import { Vector3 } from "three";
import { anchorPoint } from "../body";
import { buildExerciseSpec } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle, pin } from "../solver";

/** Hands rest on the bar at the hip crease. Start is the low hips; the peak is full extension. */
const ARMS = {
  "shoulder.plane": 85,
  "shoulder.twist": 6,
  "elbow.flex": 85,
  "forearm.pron": 72,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "barbell-hip-thrust",
  catalogId: "1a35c6f170d88059b804ff16ff621a1c",
  name: "Barbell Hip Thrust",
  defaultLoadKg: 24,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Drive", "Lockout", "Lower", "Bottom"],
  tempo: { lower: 1.4, bottom: 0.55, raise: 1.2, top: 0.35 },
  station: { kind: "hip-thrust", stanceX: 0.16, heelZ: 0.5, benchTopY: 0.42 },
  apparatus: { kind: "barbell", restAnchor: "pelvisFront", gripX: 0.36 },
  extraGoals: (body) => {
    const pelvis = new Vector3();
    const hand = new Vector3();
    return [
      ({ frame, push }) => {
        anchorPoint(body, frame, "pelvisFront", pelvis);
        for (const side of ["L", "R"] as const) {
          anchorPoint(body, frame, `grip_${side}`, hand);
          push(34 * (hand.y - pelvis.y));
          push(34 * (hand.z - (pelvis.z + 0.02)));
        }
      },
    ];
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
      "shoulder.elev": 42,
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
      "shoulder.elev": 36,
      "elbow.flex": 48,
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
      "At the end of the lifting phase, you should be able to draw a straight line from your knee through your hip to your shoulder.",
      "hip_L.flex",
      45,
    ),
    checkJointWithinAt(
      "bottom-flex",
      "Hips start flexed",
      "Lower your hips through the full range of motion your hip mobility comfortably permits.",
      "hip_L.flex",
      "start",
      45,
      110,
    ),
    checkJointWithinAt(
      "knees-bent",
      "Knees stay near a right angle",
      "Position your feet far enough back that your knees will be bent by approximately 90 degrees at the top of your hip thrust.",
      "knee_L.flex",
      "peak",
      65,
      115,
    ),
    checkJointWithinAt(
      "lockout",
      "Hips reach full extension",
      "Lift your hips up by driving your heels into the ground and squeezing your glutes until your thighs and torso align.",
      "hip_L.flex",
      "peak",
      -15,
      25,
    ),
  ],
});
