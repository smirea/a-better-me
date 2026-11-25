import { smithMachine } from "../equipment";
import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { anchorPoint } from "../body";
import { lockAngle, mirrored, pin } from "../solver";

const ARMS = {
  "shoulder.plane": 85,
  "shoulder.twist": 6,
  "elbow.flex": 82,
  "forearm.pron": 72,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "single-leg-smith-machine-hip-thrust",
  catalogId: "27f5c6f170d880a59b85fcf9ca2a0a2d",
  name: "Single Leg Smith Machine Hip Thrust",
  defaultLoadKg: 25,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Drive", "Lockout", "Lower", "Bottom"],
  tempo: { lower: 1.4, bottom: 0.4, raise: 1.2, top: 0.35 },
  station: { kind: "hip-thrust", stanceX: 0.14, heelZ: 0.48, benchTopY: 0.42 },
  apparatus: { kind: "barbell", restAnchor: "pelvisFront", gripX: 0.38 },
  extraEquipment: smithMachine({ stopY: 0.32 }),
  extraContacts: { bar: { thigh_L: 0.05, thigh_R: 0.05 } },
  extraGoals: (body) => {
    const pelvis = new Vector3();
    const hand = new Vector3();
    return [
      mirrored(body, 8),
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
      lockAngle(body, "hip_L.flex", 55, 40),
      lockAngle(body, "hip_R.flex", 55, 40),
      pin(body, "pelvisFront", () => new Vector3(0, 0.38, 0.16), 40, "yz"),
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
      "root.y": 0.46,
      "root.z": 0.02,
      "root.pitch": -18,
      "hip.flex": 48,
      "hip.abd": 8,
      "knee.flex": 96,
      "ankle.dorsi": 6,
      "shoulder.elev": 40,
      "neck.flex": 16,
      "lumbar.flex": 4,
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
      "elbow.flex": 50,
      "neck.flex": 14,
      "lumbar.flex": 0,
    },
  },
  checks: () => [
    checkNeutralNeck(
      "Tuck your chin mildly toward your chest and keep holding the Smith bar.",
      28,
    ),
    checkJointRange(
      "hip-drive",
      "Working hip extends to a straight line",
      "At the top, draw a straight line from the working knee through the hip to the shoulder.",
      "hip_L.flex",
      28,
    ),
    checkJointWithinAt(
      "short-bottom",
      "The rails shorten the bottom",
      "Lower until the bar taps the bottom of the Smith rails, which is higher than a free-bar hip thrust.",
      "hip_L.flex",
      "start",
      28,
      85,
    ),
    checkJointWithinAt(
      "working-knee",
      "Working knee stays near a right angle",
      "Keep the working sole planted so that knee is about 90 degrees at lockout.",
      "knee_L.flex",
      "peak",
      65,
      115,
    ),
    checkJointWithinAt(
      "lockout",
      "Working hip reaches extension",
      "Drive the working heel down and squeeze that glute until the thigh and torso line up, with both hip bones level.",
      "hip_L.flex",
      "peak",
      -15,
      24,
    ),
  ],
});
