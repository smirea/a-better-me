import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
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
  { anchor: "palmFlat_L", bodyweightShare: 0.32, share: 0.32, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
  { anchor: "palmFlat_R", bodyweightShare: 0.32, share: 0.32, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
];

export const spec = buildExerciseSpec({
  id: "pause-push-up",
  catalogId: "2315c6f170d8808181a4f18d581bd552",
  name: "Pause Push-Up",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Lower", "Pause", "Press", "Lockout"],
  tempo: { lower: 1.6, bottom: 1.5, raise: 1.3, top: 0.35 },
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
      lockAngle(body, "elbow_L.flex", 110, 280),
      lockAngle(body, "elbow_R.flex", 110, 280),
    ],
  }),
  station: { kind: "pushup", handX: 0.241, handZ: 0.6, handElevationY: 0.031, feetElevationY: 0.078, footX: 0.15, footZ: -0.813 },
  apparatus: { kind: "none", bodyweightLoads: LOADS },
  progress: (body, frame) => -anchorPoint(body, frame, "sternum").y,
  extraContacts: { "pushup.footBox": { foot_L: 0.07, foot_R: 0.07 } },
  hints: {
    start: {
      ...POSTURE_HINTS.pronePlank,
      ...HANDS,
      "root.y": 0.56,
      "shoulder.elev": 80,
      "shoulder.plane": 84,
      "elbow.flex": 6,
      "clavicle.prot": 8,
      "clavicle.elev": 2,
    },
    end: {
      ...POSTURE_HINTS.pronePlank,
      ...HANDS,
      "root.y": 0.34,
      "root.pitch": 84,
      "shoulder.elev": 36,
      "shoulder.plane": 74,
      "elbow.flex": 112,
      "clavicle.prot": -10,
      "clavicle.elev": -2,
    },
  },
  checks: () => [
    checkJointWithinAt(
      "elbows-locked",
      "Elbows lock out before the pause rep",
      "Finish with your elbows fully straightened.",
      "elbow_L.flex",
      "top",
      0,
      20,
    ),
    checkJointWithinAt(
      "chest-down",
      "Chest lowers before the pause",
      "Lower your chest in a controlled manner until it lightly touches the ground, then pause.",
      "elbow_L.flex",
      "bottom",
      80,
      125,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows travel through the push-up",
      "Press into the ground to lift your whole body, progressively straightening your elbows.",
      "elbow_L.flex",
      65,
    ),
    checkFlatBack(
      "Tighten your abdominal muscles and squeeze your glutes so you can draw a straight line from your knees through your hips to your shoulders.",
    ),
    {
      id: "pause-hold",
      label: "Bottom pause lasts about 1.5 seconds",
      cue: "Pause for about 1.5 to 2 seconds at the bottom with your chest just above the floor.",
      evaluate: ({ sequence }) => {
        const pause = sequence.phases.find((phase) => phase.name === "bottom");
        const seconds = pause ? (pause.to - pause.from) / sequence.fps : 0;
        return { pass: seconds >= 1.4 && seconds <= 2.1, measured: `bottom hold is ${seconds.toFixed(1)} s` };
      },
    },
    {
      id: "chest-clears-floor",
      label: "Chest stays just above the floor",
      cue: "Lower your chest until it lightly touches the ground.",
      evaluate: ({ body, frames, bottom }) => {
        const y = anchorPoint(body, frames[bottom], "chestFront").y;
        return { pass: y >= 0.02 && y <= 0.28, measured: `chest is ${(y * 100).toFixed(1)} cm up at the bottom` };
      },
    },
  ],
});
