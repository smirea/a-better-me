import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Starts in a hammer grip and finishes supinated, on thick handles. */
const TRUNK = { ...POSTURE_HINTS.seatedLeanBack, "root.pitch": -8 };

const ARMS = {
  "shoulder.elev": 20,
  "shoulder.plane": 55,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "seated-fat-grip-dumbbell-biceps-curl",
  catalogId: "2a95c6f170d8809db965f6e67028f3af",
  name: "Seated Fat Grip Dumbbell Biceps Curl",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Rest"],
  tempo: { lower: 1.4, bottom: 0.35, raise: 1.8, top: 0.4 },
  station: {
    kind: "seated",
    seatY: 0.43,
    stanceX: 0.22,
    heelZ: 0.4,
    frame: { type: "adjustable-bench", backAngleDeg: 82 },
  },
  apparatus: { kind: "dumbbells", fatGrip: true },
  hints: {
    start: { ...TRUNK, ...ARMS, "shoulder.twist": 4, "forearm.pron": 0, "elbow.flex": 12 },
    end: { ...TRUNK, ...ARMS, "shoulder.twist": -14, "forearm.pron": -76, "elbow.flex": 132 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.12, -0.28, 0.1], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.12, -0.28, 0.1], 16, "xz"),
  ],
  extraContacts: {
    "bench.backPad": { pelvis: 0.05, abdomen: 0.04, girdle: 0.045 },
    "bench.seatPad": { thigh_L: 0.05, thigh_R: 0.05, thighShaft_L: 0.05, thighShaft_R: 0.05 },
  },
  checks: () => [
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start extended",
      "Sit down holding the fat-grip dumbbells by your sides with straight elbows.",
      "elbow_L.flex",
      "top",
      0,
      26,
    ),
    checkJointWithinAt(
      "starts-neutral",
      "Starts in a hammer grip",
      "Start with your palms facing in toward your sides.",
      "forearm_L.pron",
      "top",
      -24,
      24,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows fully flex at the peak",
      "Curl the dumbbells until your elbows are fully bent and your forearms touch your biceps.",
      "elbow_L.flex",
      "bottom",
      110,
      150,
    ),
    checkJointWithinAt(
      "finishes-supinated",
      "Palms face up at the top",
      "Turn your palms to face up, then back toward you, so the top is an underhand grip.",
      "forearm_L.pron",
      "bottom",
      -95,
      -50,
    ),
    checkJointRange(
      "elbow-rom",
      "Fat-grip curl",
      "Lower the dumbbells until your elbows are straight and your palms face inward again.",
      "elbow_L.flex",
      90,
    ),
    {
      id: "upper-arms-fixed",
      label: "Upper arms stay at the sides",
      cue: "Keep your upper arms fixed by your sides rather than swinging them forward.",
      evaluate: (context) => {
        let worst = 0;
        for (const frame of context.frames) {
          const shoulder = frame.pos[context.body.index.shoulder_L];
          const elbow = frame.pos[context.body.index.elbow_L];
          worst = Math.max(worst, Math.hypot(elbow.x - shoulder.x - 0.12, elbow.z - shoulder.z - 0.1) * 100);
        }
        return {
          pass: worst <= 6.5,
          measured: `peaks at ${worst.toFixed(1)} cm of upper-arm drift (limit 6.5)`,
        };
      },
    },
  ],
});
