import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

const BODY = {
  "root.z": -0.05,
  "root.pitch": 55,
  "shoulder.twist": 6,
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
  { anchor: "palmFlat_L", bodyweightShare: 0.24, share: 0.24, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
  { anchor: "palmFlat_R", bodyweightShare: 0.24, share: 0.24, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
];

export const spec = buildExerciseSpec({
  id: "kneeling-close-grip-push-up",
  catalogId: "2305c6f170d88078a76adb67cce87454",
  name: "Kneeling Close Grip Push-Up",
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
  station: { kind: "pushup", handX: 0.217, handZ: 0.649, handElevationY: 0.06, kneesOnFloor: true },
  apparatus: { kind: "none", bodyweightLoads: LOADS },
  progress: (body, frame) => -anchorPoint(body, frame, "sternum").y,
  extraContacts: { "pushup.handBox": { hand_L: 0.08, hand_R: 0.08, forearm_L: 0.05, forearm_R: 0.05 } },
  hints: {
    start: {
      ...POSTURE_HINTS.pronePlank,
      ...BODY,
      "root.y": 0.36,
      "shoulder.elev": 78,
      "shoulder.plane": 86,
      "elbow.flex": 6,
      "clavicle.prot": 4,
      "clavicle.elev": 2,
    },
    end: {
      ...POSTURE_HINTS.pronePlank,
      ...BODY,
      "root.y": 0.28,
      "root.pitch": 64,
      "shoulder.elev": 42,
      "shoulder.plane": 80,
      "elbow.flex": 108,
      "clavicle.prot": -8,
      "clavicle.elev": -2,
    },
  },
  checks: () => [
    checkJointWithinAt(
      "elbows-locked",
      "Elbows lock out with the hands close",
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
      75,
      125,
    ),
    checkJointRange("elbow-rom", "Elbows travel through the close kneeling push-up", "Press the floor away and straighten the elbows.", "elbow_L.flex", 55),
    checkFlatBack("Keep a straight line from your knees through your hips to your shoulders."),
    {
      id: "elbows-tucked",
      label: "Elbows stay tucked",
      cue: "Keep your elbows tucked by your sides with a close hand placement.",
      evaluate: (context) =>
        everyFrame(context, (_, a) => {
          const plane = Math.abs(a["shoulder_L.plane"]) * (180 / Math.PI);
          return plane < 68 ? 68 - plane : 0;
        }, 18, "° short of a tucked arm plane"),
    },
    {
      id: "feet-off-floor",
      label: "Feet stay off the floor",
      cue: "Kneel so your feet stay up off the floor.",
      evaluate: (context) =>
        everyFrame(context, (frame) => {
          const y = anchorPoint(context.body, frame, "toe_L").y;
          return y < 0.08 ? (0.08 - y) * 100 : 0;
        }, 2, "cm of toe drop"),
    },
  ],
});
