import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

const HANDS = {
  "root.z": 0.04,
  "root.pitch": 62,
  "shoulder.twist": 6,
  "forearm.pron": 75,
  "wrist.flex": -24,
  "hip.flex": 12,
  "hip.abd": 6,
  "knee.flex": 8,
  "ankle.dorsi": -18,
  "neck.flex": 10,
  "lumbar.flex": 0,
  "thoracic.flex": 0,
};

const LOADS = [
  { anchor: "palmFlat_L", bodyweightShare: 0.265, share: 0.265, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
  { anchor: "palmFlat_R", bodyweightShare: 0.265, share: 0.265, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
];

export const spec = buildExerciseSpec({
  id: "incline-push-up",
  catalogId: "1a05c6f170d8808092c2da8955b361f1",
  name: "Incline Push-Up",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 1.6, bottom: 0.2, raise: 1.3, top: 0.35 },
  stiffness: { elbow: 80, shoulder: 8, hip: 8, knee: 10, ankle: 12 },
  extraGoals: (body) => [
    lockAngle(body, "ankle_L.dorsi", -18, 28),
    lockAngle(body, "ankle_R.dorsi", -18, 28),
    lockAngle(body, "knee_L.flex", 8, 22),
    lockAngle(body, "knee_R.flex", 8, 22),
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
  station: { kind: "pushup", handX: 0.34, handZ: 0.42, handElevationY: 0.44, feetElevationY: 0.08, footX: 0.13, footZ: -0.95 },
  extraContacts: { "pushup.footBox": { foot_L: 0.07, foot_R: 0.07 } },
  apparatus: { kind: "none", bodyweightLoads: LOADS },
  hints: {
    start: {
      ...POSTURE_HINTS.pronePlank,
      ...HANDS,
      "root.y": 0.78,
      "shoulder.elev": 72,
      "shoulder.plane": 70,
      "elbow.flex": 6,
      "clavicle.prot": 6,
      "clavicle.elev": 2,
    },
    end: {
      ...POSTURE_HINTS.pronePlank,
      ...HANDS,
      "root.y": 0.64,
      "root.pitch": 70,
      "shoulder.elev": 42,
      "shoulder.plane": 60,
      "elbow.flex": 100,
      "clavicle.prot": -8,
      "clavicle.elev": -2,
    },
  },
  checks: () => [
    checkJointWithinAt(
      "elbows-locked",
      "Elbows lock out on the elevated surface",
      "Finish with your elbows fully straightened.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "chest-to-surface",
      "Chest lowers to the elevated surface",
      "Bend your elbows to lower your chest in a controlled manner until it lightly touches the elevated surface.",
      "elbow_L.flex",
      "bottom",
      75,
      125,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows travel through the incline push-up",
      "Press into the surface to lift your whole body, progressively straightening your elbows.",
      "elbow_L.flex",
      55,
    ),
    checkFlatBack(
      "Tighten your abdominal muscles and squeeze your glutes so you can draw a straight line from your knees through your hips to your shoulders.",
    ),
    {
      id: "hands-elevated",
      label: "Hands rest on a bench-height surface",
      cue: "Place your palms on top of the elevated object with your elbows straight.",
      evaluate: ({ body, frames }) => {
        const y = anchorPoint(body, frames[0], "palmFlat_L").y;
        return { pass: y >= 0.36 && y <= 0.52, measured: `hands are ${(y * 100).toFixed(0)} cm up` };
      },
    },
    {
      id: "feet-on-floor",
      label: "Feet stay on the floor behind the bench",
      cue: "Walk your feet back until your hips and knees are straightened.",
      evaluate: (context) =>
        everyFrame(context, (frame) => {
          const y = anchorPoint(context.body, frame, "ballIn_L").y;
          return y > 0.12 ? (y - 0.12) * 100 : 0;
        }, 4, "cm of foot float"),
    },
  ],
});
