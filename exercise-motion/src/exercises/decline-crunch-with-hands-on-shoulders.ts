import { buildExerciseSpec } from "../builders";
import type { PadSurface } from "../equipment-library";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { restBackOnPad } from "../postures";

const SEAT_Y = 0.52;
const HINGE_Z = -0.06;
const BACK_DEG = -28;
const BACK_A = (BACK_DEG * Math.PI) / 180;

const BACK: PadSurface = {
  origin: [0, SEAT_Y, HINGE_Z],
  normal: [0, Math.cos(BACK_A), Math.sin(BACK_A)],
  up: [0, Math.sin(BACK_A), -Math.cos(BACK_A)],
};

const ARMS = {
  "shoulder.elev": 46,
  "shoulder.plane": 76,
  "shoulder.twist": 40,
  "elbow.flex": 126,
  "forearm.pron": 18,
  "wrist.flex": 6,
};

const DOWN = {
  "root.y": 0.62,
  "root.z": -0.02,
  "root.pitch": -112,
  "lumbar.flex": 8,
  "thoracic.flex": 4,
  "neck.flex": 8,
  "hip.flex": 34,
  "hip.abd": 8,
  "knee.flex": 96,
  "ankle.dorsi": 8,
  ...ARMS,
};

const UP = {
  ...DOWN,
  "root.y": 0.66,
  "root.pitch": -100,
  "lumbar.flex": 14,
  "thoracic.flex": 30,
  "neck.flex": 16,
};

export const spec = buildExerciseSpec({
  id: "decline-crunch-with-hands-on-shoulders",
  catalogId: "2565c6f170d88044b9e8dd1209a999a6",
  name: "Decline Crunch With Hands On Shoulders",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  brace: true,
  phaseLabels: ["Lie", "Crunch", "Peak", "Lower"],
  station: {
    kind: "seated",
    seatY: SEAT_Y,
    seatZ: -0.02,
    pinBack: false,
    feetMode: "hanging",
    passiveJoints: ["knee", "ankle", "clavicle", "wrist"],
    frame: {
      type: "adjustable-bench",
      backAngleDeg: BACK_DEG,
      seatTiltDeg: 0,
      hingeZ: HINGE_Z,
      ankleRollers: true,
    },
  },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 10, thoracic: 8, hip: 6, knee: 8 },
  extraContacts: {
    "bench.backPad": { pelvis: 0.12, abdomen: 0.06, chest: 0.05, girdle: 0.06, head: 0.04, thigh_L: 0.07, thigh_R: 0.07 },
    "bench.seatPad": { pelvis: 0.06, thigh_L: 0.05, thigh_R: 0.05 },
    "bench.rollerTop": { shank_L: 0.1, shank_R: 0.1, foot_L: 0.06, foot_R: 0.06 },
    "bench.rollerLow": { foot_L: 0.05, foot_R: 0.05, shank_L: 0.04, shank_R: 0.04 },
    "bench.spine": { chest: 0.05, abdomen: 0.05, pelvis: 0.06 },
  },
  extraKeyGoals: (body) => ({
    start: restBackOnPad(body, BACK, { sacrumAlong: null, upperBackAlong: 0.42, occiputAlong: 0.68, weight: 22 }),
  }),
  hints: { start: DOWN, end: UP },
  checks: () => [
    checkJointRange(
      "upper-back-curl",
      "Middle back curls the shoulder blades off the bench",
      "Lift your head and shoulder blades up off the bench by curling your middle back.",
      "thoracic.flex",
      14,
    ),
    checkJointWithinAt(
      "low-back-stays",
      "Lower back stays on the bench",
      "Given that this is a crunch rather than a sit-up, the lower half of your back should remain in contact with the bench.",
      "lumbar.flex",
      "peak",
      0,
      26,
    ),
    checkJointWithinAt(
      "arms-crossed",
      "Hands stay on the shoulders",
      "Cross your arms across your chest with bent elbows to position each hand on the front of the opposite shoulder.",
      "elbow_L.flex",
      "peak",
      100,
      145,
    ),
    checkJointWithinAt(
      "hips-quiet",
      "Hips do not sit the torso all the way up",
      "You have reached the end of the lifting phase once crunching further would require the lower half of your back to lift off the bench.",
      "hip_L.flex",
      "peak",
      0,
      48,
    ),
  ],
});
