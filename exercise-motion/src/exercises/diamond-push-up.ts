import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

const HANDS = {
  "root.z": 0,
  "root.pitch": 74,
  "shoulder.twist": 8,
  "forearm.pron": 78,
  "wrist.flex": -22,
  "hip.flex": 18,
  "hip.abd": 6,
  "knee.flex": 14,
  "ankle.dorsi": -8,
  "neck.flex": 8,
  "lumbar.flex": 0,
  "thoracic.flex": 0,
};

const LOADS = [
  { anchor: "palmFlat_L", bodyweightShare: 0.28, share: 0.28, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
  { anchor: "palmFlat_R", bodyweightShare: 0.28, share: 0.28, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
];

export const spec = buildExerciseSpec({
  id: "diamond-push-up",
  catalogId: "2335c6f170d880b3bf05fbd3fe896667",
  name: "Diamond Push-Up",
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
      lockAngle(body, "elbow_L.flex", 112, 280),
      lockAngle(body, "elbow_R.flex", 112, 280),
    ],
  }),
  station: { kind: "pushup", handX: 0.08, handZ: 0.58, feetElevationY: 0.08, footX: 0.14, footZ: -0.82 },
  extraContacts: { "pushup.footBox": { foot_L: 0.07, foot_R: 0.07 } },
  apparatus: { kind: "none", bodyweightLoads: LOADS },
  hints: {
    start: {
      ...POSTURE_HINTS.pronePlank,
      ...HANDS,
      "root.y": 0.56,
      "shoulder.elev": 70,
      "shoulder.plane": 80,
      "elbow.flex": 6,
      "clavicle.prot": 4,
      "clavicle.elev": 2,
    },
    end: {
      ...POSTURE_HINTS.pronePlank,
      ...HANDS,
      "root.y": 0.34,
      "root.pitch": 84,
      "shoulder.elev": 30,
      "shoulder.plane": 78,
      "elbow.flex": 114,
      "clavicle.prot": -10,
      "clavicle.elev": -2,
    },
  },
  checks: () => [
    checkJointWithinAt(
      "elbows-locked",
      "Elbows lock out over the diamond",
      "Finish with your elbows fully straightened.",
      "elbow_L.flex",
      "top",
      0,
      20,
    ),
    checkJointWithinAt(
      "chest-to-hands",
      "Elbows bend until the chest meets the hands",
      "Bend your elbows to lower your chest in a controlled manner until it lightly touches your hands.",
      "elbow_L.flex",
      "bottom",
      85,
      130,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows travel through the diamond push-up",
      "Press into the ground to lift your whole body, progressively straightening your elbows.",
      "elbow_L.flex",
      70,
    ),
    checkFlatBack(
      "Tighten your abdominal muscles and squeeze your glutes so you can draw a straight line from your knees through your hips to your shoulders.",
    ),
    {
      id: "hands-together",
      label: "Hands form a narrow diamond under the chest",
      cue: "Form a diamond shape with your index fingers and thumbs by bringing your hands together underneath your chest.",
      evaluate: ({ body, frames }) => {
        const x = Math.abs(anchorPoint(body, frames[0], "palmFlat_L").x);
        return { pass: x <= 0.14, measured: `hand is ${(x * 100).toFixed(0)} cm from midline` };
      },
    },
    {
      id: "elbows-tucked",
      label: "Elbows stay tucked beside the ribs",
      cue: "Rather than excessively flaring your elbows out away from your sides, keep your elbows reasonably tucked by your sides.",
      evaluate: (context) =>
        everyFrame(context, (_, a) => {
          const plane = Math.abs(a["shoulder_L.plane"]) * (180 / Math.PI);
          return plane < 68 ? 68 - plane : 0;
        }, 18, "° short of a tucked arm plane"),
    },
  ],
});
