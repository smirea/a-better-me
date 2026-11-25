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
  "hip.flex": 16,
  "hip.abd": 6,
  "knee.flex": 12,
  "ankle.dorsi": -8,
  "neck.flex": 8,
  "lumbar.flex": 0,
  "thoracic.flex": 0,
};

const LOADS = [
  { anchor: "palmFlat_L", bodyweightShare: 0.3, share: 0.3, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
  { anchor: "palmFlat_R", bodyweightShare: 0.3, share: 0.3, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
];

export const spec = buildExerciseSpec({
  id: "plyometric-push-up",
  catalogId: "2325c6f170d880689d2ad83e247c26c5",
  name: "Plyometric Push-Up",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Dip", "Load", "Explode", "Land"],
  tempo: { lower: 0.7, bottom: 0.08, raise: 0.9, top: 0.15 },
  stiffness: { elbow: 80, shoulder: 8, hip: 10, knee: 10, ankle: 12 },
  extraGoals: (body) => [
    lockAngle(body, "ankle_L.dorsi", -8, 36),
    lockAngle(body, "ankle_R.dorsi", -8, 36),
    lockAngle(body, "knee_L.flex", 10, 24),
    lockAngle(body, "knee_R.flex", 10, 24),
  ],
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "elbow_L.flex", 4, 420),
      lockAngle(body, "elbow_R.flex", 4, 420),
    ],
    end: [
      lockAngle(body, "elbow_L.flex", 100, 300),
      lockAngle(body, "elbow_R.flex", 100, 300),
    ],
  }),
  station: { kind: "pushup", handX: 0.34, handZ: 0.58, feetElevationY: 0.08, footX: 0.14, footZ: -0.82 },
  extraContacts: { "pushup.footBox": { foot_L: 0.07, foot_R: 0.07 } },
  apparatus: { kind: "none", bodyweightLoads: LOADS },
  hints: {
    start: {
      ...POSTURE_HINTS.pronePlank,
      ...HANDS,
      "root.y": 0.58,
      "shoulder.elev": 82,
      "shoulder.plane": 72,
      "elbow.flex": 4,
      "clavicle.prot": 8,
      "clavicle.elev": 2,
    },
    end: {
      ...POSTURE_HINTS.pronePlank,
      ...HANDS,
      "root.y": 0.36,
      "root.pitch": 80,
      "shoulder.elev": 46,
      "shoulder.plane": 62,
      "elbow.flex": 100,
      "clavicle.prot": -6,
      "clavicle.elev": 0,
    },
  },
  checks: () => [
    checkJointWithinAt(
      "elbows-locked",
      "Elbows snap straight on the explosive push",
      "Your hands should only lift off the ground after you have fully straightened your elbows.",
      "elbow_L.flex",
      "top",
      0,
      16,
    ),
    checkJointWithinAt(
      "chest-low",
      "Chest dips to about an inch off the floor",
      "Bend your elbows to lower your chest in a quick but controlled manner until it is just about one inch above the ground.",
      "elbow_L.flex",
      "bottom",
      75,
      120,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows travel through the plyometric push-up",
      "Forcefully push the ground away with a maximally explosive intent.",
      "elbow_L.flex",
      60,
    ),
    checkFlatBack(
      "Tighten your abdominal muscles and squeeze your glutes so you can draw a straight line from your knees through your hips to your shoulders.",
    ),
    {
      id: "explosive-raise",
      label: "The press phase is fast",
      cue: "Immediately after reaching the bottom, forcefully push the ground away.",
      evaluate: ({ sequence }) => {
        const raise = sequence.phases.find((phase) => phase.name === "raise");
        const seconds = raise ? (raise.to - raise.from) / sequence.fps : 0;
        return { pass: seconds > 0 && seconds <= 1.05, measured: `raise lasts ${seconds.toFixed(2)} s` };
      },
    },
    {
      id: "moderate-flare",
      label: "Elbows flare moderately",
      cue: "Let your elbows flare out moderately away from your sides.",
      evaluate: (context) =>
        everyFrame(context, (_, a) => {
          const flare = 90 - Math.abs(a["shoulder_L.plane"]) * (180 / Math.PI);
          if (flare < 28) return 28 - flare;
          if (flare > 82) return flare - 82;
          return 0;
        }, 18, "° outside a moderate elbow flare"),
    },
  ],
});
