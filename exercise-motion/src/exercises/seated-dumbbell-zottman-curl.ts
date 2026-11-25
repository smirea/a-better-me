import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";

/**
 * Supinate on the way up, rotate to a reverse grip at the top, and lower pronated.
 * The turn back to an underhand grip happens with the elbows straight.
 */
const TRUNK = { ...POSTURE_HINTS.seatedLeanBack, "root.pitch": -8 };

const ARMS = {
  "shoulder.elev": 20,
  "shoulder.plane": 70,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

const downSupinated = {
  ...TRUNK,
  ...ARMS,
  "shoulder.twist": -14,
  "forearm.pron": -76,
  "elbow.flex": 12,
};

const upSupinated = {
  ...TRUNK,
  ...ARMS,
  "shoulder.twist": -14,
  "forearm.pron": -76,
  "elbow.flex": 130,
};

const upPronated = {
  ...TRUNK,
  ...ARMS,
  "shoulder.twist": 16,
  "forearm.pron": 76,
  "elbow.flex": 130,
};

const downPronated = {
  ...TRUNK,
  ...ARMS,
  "shoulder.twist": 16,
  "forearm.pron": 76,
  "elbow.flex": 12,
};

export const spec = buildExerciseSpec({
  id: "seated-dumbbell-zottman-curl",
  catalogId: "2b25c6f170d88028809bfcde86c6e69e",
  name: "Seated Dumbbell Zottman Curl",
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
  hints: { start: downSupinated, end: upSupinated },
  waypoints: [
    { hints: downSupinated, duration: 1.5, hold: 0.25 },
    { hints: upSupinated, duration: 1.2, hold: 0.2 },
    { hints: upPronated, duration: 1.5, hold: 0.25 },
    { hints: downPronated, duration: 1.3, hold: 0.2 },
  ],
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.16, -0.27, 0.18], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.16, -0.27, 0.18], 16, "xz"),
  ],
  extraContacts: {
    "bench.backPad": { pelvis: 0.05, abdomen: 0.04, girdle: 0.045 },
    "bench.seatPad": { thigh_L: 0.05, thigh_R: 0.05, thighShaft_L: 0.05, thighShaft_R: 0.05 },
  },
  checks: () => [
    checkJointWithinAt(
      "starts-extended-supinated",
      "Starts extended in an underhand grip",
      "With straight elbows, direct your palms forward to adopt an underhand grip.",
      "forearm_L.pron",
      "top",
      -95,
      -50,
    ),
    checkJointWithinAt(
      "peak-still-supinated",
      "The lift finishes underhand",
      "Curl without rotating your palms. At the top your palms face back toward your shoulders.",
      "forearm_L.pron",
      "bottom",
      -95,
      -45,
    ),
    checkJointWithinAt(
      "peak-flexed",
      "Elbows fully flex before the turn",
      "At the top of the curl your elbows are fully bent and your forearms touch your biceps.",
      "elbow_L.flex",
      "bottom",
      105,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Zottman curl",
      "Curl the dumbbells up, then lower them with straight wrists until the elbows are extended.",
      "elbow_L.flex",
      85,
    ),
    checkJointRange(
      "pronation-turn",
      "Grip reverses at the top",
      "At the top, rotate your palms forward into an overhand grip, and lower without rotating them back.",
      "forearm_L.pron",
      110,
    ),
    {
      id: "eccentric-pronated",
      label: "The lowering phase stays overhand",
      cue: "Keep the reverse grip while you lower, so the palms face down when the forearms are level.",
      evaluate: ({ angles }) => {
        const i = Math.min(angles.length - 1, Math.floor(angles.length * 0.62));
        const val = deg(angles[i]["forearm_L.pron"]);
        return {
          pass: val >= 40,
          measured: `forearm pronation is ${val.toFixed(0)}° on the way down (target at least 40°)`,
        };
      },
    },
  ],
});
