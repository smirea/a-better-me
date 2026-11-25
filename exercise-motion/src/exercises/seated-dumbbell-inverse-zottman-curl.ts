import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";

/**
 * Inverse Zottman: hammer grip on the way up, then supinate and lower underhand.
 */
const TRUNK = { ...POSTURE_HINTS.seatedLeanBack, "root.pitch": -8 };

const ARMS = {
  "shoulder.elev": 20,
  "shoulder.plane": 52,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

const downHammer = {
  ...TRUNK,
  ...ARMS,
  "shoulder.twist": 4,
  "forearm.pron": 0,
  "elbow.flex": 12,
};

const upHammer = {
  ...TRUNK,
  ...ARMS,
  "shoulder.twist": 4,
  "forearm.pron": 0,
  "elbow.flex": 130,
};

const upSupinated = {
  ...TRUNK,
  ...ARMS,
  "shoulder.twist": -14,
  "forearm.pron": -76,
  "elbow.flex": 130,
};

const downSupinated = {
  ...TRUNK,
  ...ARMS,
  "shoulder.twist": -14,
  "forearm.pron": -76,
  "elbow.flex": 12,
};

export const spec = buildExerciseSpec({
  id: "seated-dumbbell-inverse-zottman-curl",
  catalogId: "2ab5c6f170d880d0b915ff1da3c9d7b9",
  name: "Seated Dumbbell Inverse Zottman Curl",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Rotate", "Lower", "Reset"],
  loopMode: "cycle",
  tempo: { lower: 1.2, bottom: 0.35, raise: 1.4, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.43,
    stanceX: 0.22,
    heelZ: 0.4,
    frame: { type: "adjustable-bench", backAngleDeg: 82 },
  },
  apparatus: { kind: "dumbbells" },
  hints: { start: downHammer, end: upHammer },
  waypoints: [
    { hints: downHammer, duration: 0.9, hold: 0.2 },
    { hints: upHammer, duration: 1.2, hold: 0.2 },
    { hints: upSupinated, duration: 0.9, hold: 0.2 },
    { hints: downSupinated, duration: 1.3, hold: 0.2 },
  ],
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.12, -0.28, 0.1], 14, "xz"),
    holdElbowNearShoulder(body, "R", [0.12, -0.28, 0.1], 14, "xz"),
  ],
  extraContacts: {
    "bench.backPad": { pelvis: 0.05, abdomen: 0.04, girdle: 0.045 },
    "bench.seatPad": { thigh_L: 0.05, thigh_R: 0.05, thighShaft_L: 0.05, thighShaft_R: 0.05 },
  },
  checks: () => [
    checkJointWithinAt(
      "starts-hammer",
      "Starts in a hammer grip",
      "With straight elbows, turn your palms in toward your sides.",
      "forearm_L.pron",
      "top",
      -24,
      24,
    ),
    checkJointWithinAt(
      "peak-still-hammer",
      "The lift stays neutral",
      "Curl while keeping your palms facing in toward each other.",
      "forearm_L.pron",
      "bottom",
      -28,
      28,
    ),
    checkJointWithinAt(
      "peak-flexed",
      "Elbows fully flex before the turn",
      "At the top your elbows are fully bent and your forearms touch your biceps.",
      "elbow_L.flex",
      "bottom",
      105,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Inverse Zottman curl",
      "Lower the dumbbells under control until your elbows are straight.",
      "elbow_L.flex",
      85,
    ),
    checkJointRange(
      "supination-turn",
      "Grip turns underhand at the top",
      "Rotate your palms back toward your shoulders, then lower without rotating them.",
      "forearm_L.pron",
      55,
    ),
    {
      id: "eccentric-supinated",
      label: "The lowering phase stays underhand",
      cue: "Keep the underhand grip on the way down, so the palms face up when the forearms are level.",
      evaluate: ({ angles }) => {
        const i = Math.min(angles.length - 1, Math.floor(angles.length * 0.62));
        const val = deg(angles[i]["forearm_L.pron"]);
        return {
          pass: val <= -40,
          measured: `forearm pronation is ${val.toFixed(0)}° on the way down (target at most -40°)`,
        };
      },
    },
  ],
});
