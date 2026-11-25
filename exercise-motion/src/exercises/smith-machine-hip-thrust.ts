import { smithMachine } from "../equipment";
import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { anchorPoint } from "../body";
import { lockAngle, pin } from "../solver";

const ARMS = {
  "shoulder.plane": 85,
  "shoulder.twist": 6,
  "elbow.flex": 85,
  "forearm.pron": 72,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "smith-machine-hip-thrust",
  catalogId: "1a35c6f170d880c0808de2493284ed5b",
  name: "Smith Machine Hip Thrust",
  defaultLoadKg: 20,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Drive", "Lockout", "Lower", "Bottom"],
  tempo: { lower: 1.4, bottom: 0.4, raise: 1.2, top: 0.35 },
  station: { kind: "hip-thrust", stanceX: 0.16, heelZ: 0.5, benchTopY: 0.42 },
  apparatus: { kind: "barbell", restAnchor: "pelvisFront", gripX: 0.36 },
  extraEquipment: smithMachine({ stopY: 0.32 }),
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
      "thoracic.flex": 2,
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
      "thoracic.flex": 0,
    },
  },
  checks: () => [
    checkNeutralNeck(
      "Tuck your chin mildly toward your chest, and keep holding the bar with that neck position.",
      28,
    ),
    checkJointRange(
      "hip-drive",
      "Hips extend to a straight line",
      "At the top, draw a straight line from your knee through your hip to your shoulder.",
      "hip_L.flex",
      30,
    ),
    checkJointWithinAt(
      "short-bottom",
      "The rails shorten the bottom",
      "Most Smith machines stop the bar before your glutes reach the floor, so the bottom is higher than a barbell hip thrust.",
      "hip_L.flex",
      "start",
      28,
      80,
    ),
    checkJointWithinAt(
      "knees-bent",
      "Knees stay near a right angle",
      "Place your feet so the knees are about 90 degrees when your hips are locked out.",
      "knee_L.flex",
      "peak",
      65,
      115,
    ),
    checkJointWithinAt(
      "lockout",
      "Hips reach full extension",
      "Drive your heels down and squeeze your glutes until your thighs and torso line up.",
      "hip_L.flex",
      "peak",
      -15,
      24,
    ),
  ],
});
