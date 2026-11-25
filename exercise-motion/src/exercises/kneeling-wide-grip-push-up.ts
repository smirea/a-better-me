import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

const BODY = {
  "root.z": -0.05,
  "root.pitch": 55,
  "shoulder.twist": 8,
  "forearm.pron": 75,
  "wrist.flex": -28,
  "hip.flex": 8,
  "hip.abd": 8,
  "knee.flex": 90,
  "ankle.dorsi": -25,
  "neck.flex": 6,
  "lumbar.flex": 0,
  "thoracic.flex": 0,
};

const LOADS = [
  { anchor: "palmFlat_L", bodyweightShare: 0.22, share: 0.22, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
  { anchor: "palmFlat_R", bodyweightShare: 0.22, share: 0.22, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
];

export const spec = buildExerciseSpec({
  id: "kneeling-wide-grip-push-up",
  catalogId: "2305c6f170d8800693c2e97be7e4ff71",
  name: "Kneeling Wide Grip Push-Up",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 1.6, bottom: 0.2, raise: 1.3, top: 0.35 },
  stiffness: { elbow: 80, shoulder: 8, hip: 8, knee: 12, ankle: 8 },
  extraGoals: (body) => [
    lockAngle(body, "knee_L.flex", 90, 30),
    lockAngle(body, "knee_R.flex", 90, 30),
    lockAngle(body, "ankle_L.dorsi", -25, 16),
    lockAngle(body, "ankle_R.dorsi", -25, 16),
    lockAngle(body, "lumbar.flex", 0, 24),
    lockAngle(body, "thoracic.flex", 0, 18),
    lockAngle(body, "shoulder_L.plane", 55, 22),
    lockAngle(body, "shoulder_R.plane", 55, 22),
  ],
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "elbow_L.flex", 8, 400),
      lockAngle(body, "elbow_R.flex", 8, 400),
    ],
    end: [
      lockAngle(body, "elbow_L.flex", 100, 280),
      lockAngle(body, "elbow_R.flex", 100, 280),
    ],
  }),
  station: { kind: "pushup", handX: 0.46, handZ: 0.62, kneesOnFloor: true },
  apparatus: { kind: "none", bodyweightLoads: LOADS },
  extraContacts: { "pushup.handBox": { hand_L: 0.08, hand_R: 0.08, forearm_L: 0.05, forearm_R: 0.05 } },
  hints: {
    start: {
      ...POSTURE_HINTS.pronePlank,
      ...BODY,
      "root.y": 0.36,
      "shoulder.elev": 78,
      "shoulder.plane": 58,
      "elbow.flex": 6,
      "clavicle.prot": 8,
      "clavicle.elev": 4,
    },
    end: {
      ...POSTURE_HINTS.pronePlank,
      ...BODY,
      "root.y": 0.28,
      "root.pitch": 64,
      "shoulder.elev": 46,
      "shoulder.plane": 52,
      "elbow.flex": 100,
      "clavicle.prot": -6,
      "clavicle.elev": 0,
    },
  },
  checks: () => [
    checkJointWithinAt(
      "elbows-locked",
      "Elbows lock out from the knees",
      "Return to the starting position with fully straightened elbows.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "chest-down",
      "Chest lowers to the floor",
      "Lower your chest toward the ground until you are able to contact the ground with your chest.",
      "elbow_L.flex",
      "bottom",
      75,
      125,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows travel through the wide kneeling push-up",
      "Press into the ground to lift your body as you progressively straighten your elbows.",
      "elbow_L.flex",
      55,
    ),
    checkFlatBack("Keep a straight line from your knees through your hips to your shoulders."),
    {
      id: "hands-wide",
      label: "Hands sit about twice shoulder width",
      cue: "Situate your hands clearly outside shoulder width, about twice shoulder width apart.",
      evaluate: ({ body, frames }) => {
        const x = Math.abs(anchorPoint(body, frames[0], "palmFlat_L").x);
        return { pass: x >= 0.4, measured: `hand is ${(x * 100).toFixed(0)} cm from midline` };
      },
    },
    {
      id: "feet-off-floor",
      label: "Feet stay off the floor",
      cue: "Lift your feet up off the ground by bending your knees further, and keep them off the ground throughout your set.",
      evaluate: (context) =>
        everyFrame(context, (frame) => {
          const y = anchorPoint(context.body, frame, "toe_L").y;
          return y < 0.08 ? (0.08 - y) * 100 : 0;
        }, 2, "cm of toe drop"),
    },
  ],
});
