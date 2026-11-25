import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Supinate on the way up, pronate at the top, and lower in a reverse grip. */
const TRUNK = POSTURE_HINTS.standing;

const ARMS = {
  "shoulder.elev": 16,
  "shoulder.plane": 50,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

const downSupinated = {
  ...TRUNK,
  ...ARMS,
  "shoulder.twist": -14,
  "forearm.pron": -76,
  "elbow.flex": 8,
};

const upSupinated = {
  ...TRUNK,
  ...ARMS,
  "shoulder.twist": -14,
  "forearm.pron": -76,
  "elbow.flex": 132,
};

const upPronated = {
  ...TRUNK,
  ...ARMS,
  "shoulder.twist": 16,
  "forearm.pron": 76,
  "elbow.flex": 132,
};

const downPronated = {
  ...TRUNK,
  ...ARMS,
  "shoulder.twist": 16,
  "forearm.pron": 76,
  "elbow.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "standing-dumbbell-zottman-curl",
  catalogId: "1a15c6f170d880e79382e4a14d8116fc",
  name: "Standing Dumbbell Zottman Curl",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Rotate", "Lower", "Reset"],
  loopMode: "cycle",
  tempo: { lower: 1.2, bottom: 0.35, raise: 1.4, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: { kind: "dumbbells" },
  hints: { start: downSupinated, end: upSupinated },
  waypoints: [
    { hints: downSupinated, duration: 1.5, hold: 0.25 },
    { hints: upSupinated, duration: 1.2, hold: 0.2 },
    { hints: upPronated, duration: 1.5, hold: 0.25 },
    { hints: downPronated, duration: 1.3, hold: 0.2 },
  ],
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.06, -0.3, 0.06], 14, "xz"),
    holdElbowNearShoulder(body, "R", [0.06, -0.3, 0.06], 14, "xz"),
  ],
  checks: () => [
    checkFlatBack(
      "Stand upright in a near hip-width stance with your arms hanging down by your sides.",
    ),
    checkJointWithinAt(
      "starts-supinated",
      "Starts in an underhand grip",
      "Direct your palms forward to adopt an underhand grip before you curl.",
      "forearm_L.pron",
      "top",
      -95,
      -50,
    ),
    checkJointWithinAt(
      "peak-still-supinated",
      "The lift finishes underhand",
      "Curl without rotating your palms, so they face your shoulders at the top.",
      "forearm_L.pron",
      "bottom",
      -95,
      -45,
    ),
    checkJointWithinAt(
      "peak-flexed",
      "Elbows fully flex before the turn",
      "Finish the curl with your elbows fully bent and your forearms touching your biceps.",
      "elbow_L.flex",
      "bottom",
      110,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Zottman curl",
      "Lower the dumbbells under control until your elbows are straight.",
      "elbow_L.flex",
      90,
    ),
    checkJointRange(
      "pronation-turn",
      "Grip reverses at the top",
      "Rotate your palms forward into an overhand grip, then lower without rotating them.",
      "forearm_L.pron",
      110,
    ),
    {
      id: "eccentric-pronated",
      label: "The lowering phase stays overhand",
      cue: "Keep the reverse grip on the way down, so the palms face down when the forearms are level.",
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
