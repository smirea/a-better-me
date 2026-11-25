import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

const HANDS = {
  "root.z": 0,
  "root.pitch": 74,
  "shoulder.twist": 8,
  "forearm.pron": 75,
  "wrist.flex": -28,
  "hip.flex": 18,
  "hip.abd": 8,
  "knee.flex": 14,
  "ankle.dorsi": -8,
  "neck.flex": 8,
  "lumbar.flex": 0,
  "thoracic.flex": 0,
};

const LOADS = [
  { anchor: "palmFlat_L", bodyweightShare: 0.2, share: 0.2, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
  { anchor: "palmFlat_R", bodyweightShare: 0.2, share: 0.2, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
];

export const spec = buildExerciseSpec({
  id: "wide-grip-push-up",
  catalogId: "1a05c6f170d88091bae1f8c38abe474e",
  name: "Wide Grip Push-Up",
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
    lockAngle(body, "shoulder_L.plane", 58, 22),
    lockAngle(body, "shoulder_R.plane", 58, 22),
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
  station: { kind: "pushup", handX: 0.468, handZ: 0.573, handElevationY: 0.085, feetElevationY: 0.078, footX: 0.15, footZ: -0.813 },
  apparatus: { kind: "none", bodyweightLoads: LOADS },
  progress: (body, frame) => -anchorPoint(body, frame, "sternum").y,
  extraContacts: {
    "pushup.footBox": { foot_L: 0.07, foot_R: 0.07 },
    "pushup.handBox": { hand_L: 0.08, hand_R: 0.08, forearm_L: 0.05, forearm_R: 0.05 },
  },
  hints: {
    start: {
      ...POSTURE_HINTS.pronePlank,
      ...HANDS,
      "root.y": 0.56,
      "shoulder.elev": 78,
      "shoulder.plane": 60,
      "elbow.flex": 6,
      "clavicle.prot": 10,
      "clavicle.elev": 4,
    },
    end: {
      ...POSTURE_HINTS.pronePlank,
      ...HANDS,
      "root.y": 0.36,
      "root.pitch": 82,
      "shoulder.elev": 48,
      "shoulder.plane": 58,
      "elbow.flex": 108,
      "clavicle.prot": -6,
      "clavicle.elev": 2,
    },
  },
  checks: () => [
    checkJointWithinAt(
      "elbows-locked",
      "Elbows lock out with the hands set wide",
      "Finish with your elbows fully straightened.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "chest-down",
      "Elbows bend until the chest is down",
      "Lower your chest in a controlled manner until it lightly touches the ground.",
      "elbow_L.flex",
      "bottom",
      80,
      125,
    ),
    checkJointRange("elbow-rom", "Elbows travel through the wide push-up", "Press the floor away and straighten the elbows.", "elbow_L.flex", 60),
    checkFlatBack(
      "Tighten your abdominal muscles and squeeze your glutes so you can draw a straight line from your knees through your hips to your shoulders.",
    ),
    {
      id: "hands-wide",
      label: "Hands sit well outside the shoulders",
      cue: "Set your hands wider than shoulder width.",
      evaluate: ({ body, frames }) => {
        const x = Math.abs(anchorPoint(body, frames[0], "palmFlat_L").x);
        return { pass: x >= 0.4, measured: `hand is ${(x * 100).toFixed(0)} cm from midline` };
      },
    },
    {
      id: "flare-under-45",
      label: "Elbows flare but stay under 45° from the torso",
      cue: "Let the elbows flare out, keeping the flare under 45 degrees from your torso.",
      evaluate: (context) =>
        everyFrame(context, (_, a) => {
          const flare = 90 - Math.abs(a["shoulder_L.plane"]) * (180 / Math.PI);
          return flare > 45 ? flare - 45 : 0;
        }, 8, "° of flare past 45"),
    },
  ],
});
