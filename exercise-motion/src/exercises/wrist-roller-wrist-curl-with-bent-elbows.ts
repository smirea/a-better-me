import { ALONG_Y, cylinder } from "../equipment";
import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Elbows bent about 90 degrees, upper arms at the sides, palms down on the roller. */
const ARMS = {
  "shoulder.elev": 16,
  "shoulder.plane": 48,
  "shoulder.twist": 12,
  "elbow.flex": 92,
  "forearm.pron": 74,
  "clavicle.elev": 2,
};

const TRUNK = { ...POSTURE_HINTS.standing };

const CURL = { ...ARMS, "wrist.flex": 50 };
const OPEN = { ...ARMS, "wrist.flex": -32 };

export const spec = buildExerciseSpec({
  id: "wrist-roller-wrist-curl-with-bent-elbows",
  catalogId: "1a15c6f170d88098805dfd8e8477a9dc",
  name: "Wrist Roller Wrist Curl With Bent Elbows",
  defaultLoadKg: 3,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "hang",
  phaseLabels: ["Curl", "Switch", "Curl", "Open"],
  tempo: { lower: 0.7, bottom: 0.12, raise: 0.7, top: 0.12 },
  station: { kind: "standing", stanceX: 0.16, balanceZ: 0.08 },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 0.22, 0.62],
    columnPos: [0.58, 0.75],
    facingDir: -1,
    attachment: "straight-bar",
    attachmentWidth: 0.32,
    gripX: 0.12,
    freeGripWidth: true,
  },
  extraEquipment: [cylinder("roller.plate", [0, 0.1, 0.62], 0.11, 0.045, "plate", ALONG_Y, false)],
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.06, -0.28, 0.04], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.06, -0.28, 0.04], 16, "xz"),
  ],
  hints: {
    start: sidedHints("L", CURL, OPEN, TRUNK),
    end: sidedHints("L", OPEN, CURL, TRUNK),
  },
  checks: () => [
    checkJointRange(
      "wrist-curl",
      "Working wrist curls the roller",
      "With the elbows bent, curl one wrist toward you.",
      "wrist_L.flex",
      48,
    ),
    checkJointRange(
      "opposite-wrist",
      "The other wrist opens as the first curls",
      "Extend the other wrist so that palm points down, then switch.",
      "wrist_R.flex",
      48,
    ),
    checkJointWithinAt(
      "elbows-bent",
      "Elbows stay bent near 90 degrees",
      "Bend your elbows by about 90 degrees and keep your upper arms tucked by your sides.",
      "elbow_L.flex",
      "start",
      70,
      115,
    ),
    checkJointWithinAt(
      "palms-down",
      "Palms face down on the roller",
      "With the elbows bent, your palms face down toward the ground.",
      "forearm_L.pron",
      "start",
      48,
      90,
    ),
  ],
});
