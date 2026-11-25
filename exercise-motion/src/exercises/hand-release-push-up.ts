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
  id: "hand-release-push-up",
  catalogId: "2305c6f170d8809683abf39935685d38",
  name: "Hand Release Push-Up",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Lower", "Release", "Press", "Lockout"],
  tempo: { lower: 1.5, bottom: 0.5, raise: 1.3, top: 0.3 },
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
      lockAngle(body, "elbow_L.flex", 118, 280),
      lockAngle(body, "elbow_R.flex", 118, 280),
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
      "shoulder.plane": 70,
      "elbow.flex": 6,
      "clavicle.prot": 6,
      "clavicle.elev": 2,
    },
    end: {
      ...POSTURE_HINTS.pronePlank,
      ...HANDS,
      "root.y": 0.3,
      "root.pitch": 86,
      "shoulder.elev": 28,
      "shoulder.plane": 55,
      "elbow.flex": 118,
      "clavicle.prot": -12,
      "clavicle.elev": -4,
    },
  },
  checks: () => [
    checkJointWithinAt(
      "elbows-locked",
      "Elbows lock out before the descent",
      "Finish with your elbows fully straightened.",
      "elbow_L.flex",
      "top",
      0,
      20,
    ),
    checkJointWithinAt(
      "chest-on-mat",
      "Chest reaches the mat before the hands lift",
      "Bend your elbows to lower your chest in a controlled manner until it lightly touches the ground.",
      "elbow_L.flex",
      "bottom",
      95,
      135,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows travel through the hand-release push-up",
      "Press into the ground to lift your body, progressively straightening your elbows until you return to the tall plank.",
      "elbow_L.flex",
      75,
    ),
    checkFlatBack(
      "Tighten your abdominal muscles and squeeze your glutes so you can draw a straight line from your knees through your hips to your shoulders.",
    ),
    {
      id: "bottom-release",
      label: "Brief pause at the bottom while the hands release",
      cue: "Once your chest and thighs are resting on the ground, lift your hands just slightly off the ground.",
      evaluate: ({ sequence }) => {
        const pause = sequence.phases.find((phase) => phase.name === "bottom");
        const seconds = pause ? (pause.to - pause.from) / sequence.fps : 0;
        return { pass: seconds >= 0.4 && seconds <= 0.7, measured: `bottom hold is ${seconds.toFixed(2)} s` };
      },
    },
    {
      id: "moderate-flare",
      label: "Elbows flare moderately",
      cue: "Let your elbows flare out moderately away from your sides.",
      evaluate: (context) =>
        everyFrame(context, (_, a) => {
          const flare = 90 - Math.abs(a["shoulder_L.plane"]) * (180 / Math.PI);
          if (flare < 25) return 25 - flare;
          if (flare > 82) return flare - 82;
          return 0;
        }, 18, "° outside a moderate elbow flare"),
    },
  ],
});
