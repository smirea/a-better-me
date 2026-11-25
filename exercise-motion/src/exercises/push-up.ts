import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

const HANDS = {
  "root.z": 0,
  "root.pitch": 74,
  "shoulder.twist": 6,
  "forearm.pron": 75,
  "wrist.flex": -28,
  "hip.flex": 18,
  "hip.abd": 6,
  "knee.flex": 14,
  "ankle.dorsi": -8,
  "neck.flex": 8,
  "lumbar.flex": 0,
  "thoracic.flex": 0,
};

const LOADS = [
  { anchor: "palmFlat_L", bodyweightShare: 0.375, share: 0.375, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
  { anchor: "palmFlat_R", bodyweightShare: 0.375, share: 0.375, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
];

export const spec = buildExerciseSpec({
  id: "push-up",
  catalogId: "1a05c6f170d880a5b43fe13bcb1b6f3a",
  name: "Push-Up",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 1.6, bottom: 0.2, raise: 1.3, top: 0.35 },
  stiffness: { elbow: 80, shoulder: 8, hip: 8, knee: 10, ankle: 12 },
  extraGoals: (body) => [
    lockAngle(body, "ankle_L.dorsi", -8, 36),
    lockAngle(body, "ankle_R.dorsi", -8, 36),
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
  station: { kind: "pushup", handX: 0.34, handZ: 0.58, feetElevationY: 0.08, footX: 0.14, footZ: -0.82 },
  extraContacts: { "pushup.footBox": { foot_L: 0.07, foot_R: 0.07 } },
  apparatus: { kind: "none", bodyweightLoads: LOADS },
  hints: {
    start: {
      ...POSTURE_HINTS.pronePlank,
      ...HANDS,
      "root.y": 0.56,
      "shoulder.elev": 78,
      "shoulder.plane": 72,
      "elbow.flex": 6,
      "clavicle.prot": 6,
      "clavicle.elev": 2,
    },
    end: {
      ...POSTURE_HINTS.pronePlank,
      ...HANDS,
      "root.y": 0.34,
      "root.pitch": 82,
      "shoulder.elev": 40,
      "shoulder.plane": 62,
      "elbow.flex": 108,
      "clavicle.prot": -8,
      "clavicle.elev": -2,
    },
  },
  checks: () => [
    checkJointWithinAt(
      "elbows-locked",
      "Elbows lock out in the tall plank",
      "Finish with your elbows fully straightened.",
      "elbow_L.flex",
      "top",
      0,
      20,
    ),
    checkJointWithinAt(
      "chest-down",
      "Elbows bend until the chest is down",
      "Bend your elbows to lower your chest in a controlled manner until it lightly touches the ground.",
      "elbow_L.flex",
      "bottom",
      80,
      125,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows travel through the push-up",
      "Reverse the movement by pressing into the ground to lift your whole body, progressively straightening your elbows.",
      "elbow_L.flex",
      65,
    ),
    checkFlatBack(
      "Tighten your abdominal muscles and squeeze your glutes so you can draw a straight line from your knees through your hips to your shoulders.",
    ),
    {
      id: "hands-shoulder-width",
      label: "Hands sit mildly outside shoulder width",
      cue: "Situate your hands mildly outside shoulder width apart from each other.",
      evaluate: ({ body, frames }) => {
        const x = Math.abs(anchorPoint(body, frames[0], "palmFlat_L").x);
        return { pass: x >= 0.28 && x <= 0.42, measured: `hand is ${(x * 100).toFixed(0)} cm from midline` };
      },
    },
    {
      id: "moderate-flare",
      label: "Upper arms flare about 45–75° from the torso",
      cue: "Let your elbows flare out moderately away from your sides.",
      evaluate: (context) =>
        everyFrame(context, (_, a) => {
          const flare = 90 - Math.abs(a["shoulder_L.plane"]) * (180 / Math.PI);
          if (flare < 30) return 30 - flare;
          if (flare > 80) return flare - 80;
          return 0;
        }, 18, "° outside a moderate elbow flare"),
    },
  ],
});
