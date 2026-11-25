import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Inverted-V pike: hips stay high and the head travels toward the floor. */
const PIKE = {
  ...POSTURE_HINTS.pronePlank,
  "root.z": 0.02,
  "root.pitch": 58,
  "hip.flex": 72,
  "hip.abd": 8,
  "knee.flex": 10,
  "ankle.dorsi": -16,
  "neck.flex": 6,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "shoulder.twist": 6,
  "forearm.pron": 72,
  "wrist.flex": -30,
  "shoulder.plane": 58,
};

const LOADS = [
  { anchor: "palmFlat_L", bodyweightShare: 0.32, share: 0.32, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
  { anchor: "palmFlat_R", bodyweightShare: 0.32, share: 0.32, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
];

export const spec = buildExerciseSpec({
  id: "pike-push-up",
  catalogId: "1a15c6f170d880dfacd1c620c1010d79",
  name: "Pike Push-Up",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Lower", "Head down", "Press", "Lockout"],
  tempo: { lower: 1.5, bottom: 0.2, raise: 1.3, top: 0.3 },
  stiffness: { elbow: 70, shoulder: 8, hip: 14, knee: 12, ankle: 10 },
  extraGoals: (body) => [
    lockAngle(body, "hip_L.flex", 72, 36),
    lockAngle(body, "hip_R.flex", 72, 36),
    lockAngle(body, "knee_L.flex", 10, 28),
    lockAngle(body, "knee_R.flex", 10, 28),
    lockAngle(body, "ankle_L.dorsi", -14, 22),
    lockAngle(body, "ankle_R.dorsi", -14, 22),
  ],
  extraKeyGoals: (body) => ({
    start: [lockAngle(body, "elbow_L.flex", 8, 360), lockAngle(body, "elbow_R.flex", 8, 360)],
    end: [lockAngle(body, "elbow_L.flex", 100, 260), lockAngle(body, "elbow_R.flex", 100, 260)],
  }),
  station: { kind: "pushup", handX: 0.32, handZ: 0.5, feetElevationY: 0.1, footX: 0.12, footZ: -0.48 },
  extraContacts: { "pushup.footBox": { foot_L: 0.06, foot_R: 0.06 } },
  apparatus: { kind: "none", bodyweightLoads: LOADS },
  hints: {
    start: {
      ...PIKE,
      "root.y": 0.78,
      "shoulder.elev": 148,
      "elbow.flex": 8,
      "clavicle.elev": 8,
      "clavicle.prot": 2,
    },
    end: {
      ...PIKE,
      "root.y": 0.62,
      "root.pitch": 58,
      "shoulder.elev": 112,
      "elbow.flex": 102,
      "clavicle.elev": 2,
      "clavicle.prot": -4,
    },
  },
  checks: () => [
    checkJointWithinAt(
      "elbows-locked",
      "Elbows lock out in the pike",
      "Finish the press with the elbows fully straightened and the hips still high in an inverted V.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "head-down",
      "Elbows bend as the head lowers",
      "Lower the head toward the floor by bending the elbows, keeping the hips bent and the knees straight.",
      "elbow_L.flex",
      "bottom",
      80,
      125,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows travel through the pike",
      "Press the floor down and away until the elbows are straight, with the hips and head moving together.",
      "elbow_L.flex",
      65,
    ),
    checkJointWithinAt(
      "hips-piked",
      "Hips stay deeply bent",
      "Do not let the hips drop toward the chest. Keep the same pike while the head, torso, and hips move as one unit.",
      "hip_L.flex",
      "peak",
      55,
      110,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Knees stay straight",
      "Walk the feet forward until the knees are straight and the body is as close to an inverted V as flexibility allows.",
      "knee_L.flex",
      "peak",
      0,
      22,
    ),
    {
      id: "hands-outside-shoulders",
      label: "Hands sit slightly outside shoulder width",
      cue: "Place the hands slightly outside shoulder width, bearing weight through the heels of the palms.",
      evaluate: ({ body, frames }) => {
        const x = Math.abs(anchorPoint(body, frames[0], "palmFlat_L").x);
        return { pass: x >= 0.24 && x <= 0.42, measured: `hand is ${(x * 100).toFixed(0)} cm from midline` };
      },
    },
  ],
});
