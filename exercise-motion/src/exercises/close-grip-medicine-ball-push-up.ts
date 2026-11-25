import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";
import { stabilityBall } from "../equipment-library";

const HANDS = {
  "root.z": 0,
  "root.pitch": 68,
  "shoulder.twist": 8,
  "forearm.pron": 75,
  "wrist.flex": -18,
  "hip.flex": 16,
  "hip.abd": 6,
  "knee.flex": 12,
  "ankle.dorsi": -10,
  "neck.flex": 8,
  "lumbar.flex": 0,
  "thoracic.flex": 0,
};

const LOADS = [
  { anchor: "palmFlat_L", bodyweightShare: 0.2, share: 0.2, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
  { anchor: "palmFlat_R", bodyweightShare: 0.2, share: 0.2, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
];

export const spec = buildExerciseSpec({
  id: "close-grip-medicine-ball-push-up",
  catalogId: "2a15c6f170d8803dbc49fa71c1995ec8",
  name: "Close Grip Medicine Ball Push-Up",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 1.6, bottom: 0.2, raise: 1.3, top: 0.35 },
  stiffness: { elbow: 80, shoulder: 8, hip: 8, knee: 10, ankle: 12 },
  extraGoals: (body) => [
    lockAngle(body, "ankle_L.dorsi", -10, 32),
    lockAngle(body, "ankle_R.dorsi", -10, 32),
    lockAngle(body, "knee_L.flex", 12, 24),
    lockAngle(body, "knee_R.flex", 12, 24),
  ],
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "elbow_L.flex", 8, 400),
      lockAngle(body, "elbow_R.flex", 8, 400),
    ],
    end: [
      lockAngle(body, "elbow_L.flex", 108, 280),
      lockAngle(body, "elbow_R.flex", 108, 280),
    ],
  }),
  station: { kind: "pushup", handX: 0.11, handZ: 0.56, handElevationY: 0.28, feetElevationY: 0.08, footX: 0.14, footZ: -0.86 },
  extraContacts: { "pushup.footBox": { foot_L: 0.07, foot_R: 0.07 } },
  extraEquipment: stabilityBall(0.14, [0, 0.56]),
  apparatus: { kind: "none", bodyweightLoads: LOADS },
  hints: {
    start: {
      ...POSTURE_HINTS.pronePlank,
      ...HANDS,
      "root.y": 0.7,
      "shoulder.elev": 68,
      "shoulder.plane": 82,
      "elbow.flex": 6,
      "clavicle.prot": 4,
      "clavicle.elev": 2,
    },
    end: {
      ...POSTURE_HINTS.pronePlank,
      ...HANDS,
      "root.y": 0.5,
      "root.pitch": 76,
      "shoulder.elev": 36,
      "shoulder.plane": 76,
      "elbow.flex": 108,
      "clavicle.prot": -8,
      "clavicle.elev": -2,
    },
  },
  checks: () => [
    checkJointWithinAt(
      "elbows-locked",
      "Elbows lock out on the ball",
      "Finish with your elbows fully straightened.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "chest-to-ball",
      "Chest lowers toward the medicine ball",
      "Bend your elbows to lower your chest in a controlled manner until it lightly touches the ball.",
      "elbow_L.flex",
      "bottom",
      80,
      125,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows travel through the medicine-ball push-up",
      "Press into the ball to lift your whole body, progressively straightening your elbows.",
      "elbow_L.flex",
      60,
    ),
    checkFlatBack(
      "Tighten your abdominal muscles and squeeze your glutes so you can draw a straight line from your knees through your hips to your shoulders.",
    ),
    {
      id: "hands-on-ball",
      label: "Both hands rest close together on the ball",
      cue: "Place your hands on top of the ball with the heels of your hands firmly pressed into the ball.",
      evaluate: ({ body, frames }) => {
        const hand = anchorPoint(body, frames[0], "palmFlat_L");
        return {
          pass: Math.abs(hand.x) <= 0.16 && hand.y >= 0.2 && hand.y <= 0.36,
          measured: `hand is ${(Math.abs(hand.x) * 100).toFixed(0)} cm out and ${(hand.y * 100).toFixed(0)} cm up`,
        };
      },
    },
    {
      id: "elbows-tucked",
      label: "Elbows stay tucked",
      cue: "Rather than excessively flaring your elbows out away from your sides, keep your elbows reasonably tucked by your sides.",
      evaluate: (context) =>
        everyFrame(context, (_, a) => {
          const plane = Math.abs(a["shoulder_L.plane"]) * (180 / Math.PI);
          return plane < 64 ? 64 - plane : 0;
        }, 18, "° short of a tucked arm plane"),
    },
  ],
});
