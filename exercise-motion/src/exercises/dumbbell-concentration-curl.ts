import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

const TRUNK = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.52,
  "root.pitch": 18,
  "hip.flex": 70,
  "hip.abd": 22,
  "knee.flex": 82,
  "lumbar.flex": 4,
  "thoracic.flex": 6,
  "neck.flex": 14,
};

/** Working arm hangs between the thighs, elbow braced on the inner thigh. */
const ACTIVE = {
  "shoulder.elev": 58,
  "shoulder.plane": 28,
  "shoulder.twist": -20,
  "forearm.pron": -72,
  "wrist.flex": 4,
  "clavicle.elev": 2,
  "clavicle.prot": 8,
};

const REST = {
  "shoulder.elev": 36,
  "shoulder.plane": 40,
  "shoulder.twist": 8,
  "elbow.flex": 48,
  "forearm.pron": 8,
  "wrist.flex": 6,
  "clavicle.elev": 0,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-concentration-curl",
  catalogId: "1a15c6f170d880d7b8cbf608580aaa50",
  name: "Dumbbell Concentration Curl",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Hang"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.7, top: 0.35 },
  station: {
    kind: "seated",
    seatY: 0.46,
    stanceX: 0.28,
    heelZ: 0.42,
    frame: { type: "flat-bench", zHead: -0.42, zFoot: 0.28 },
  },
  apparatus: { kind: "dumbbells", sides: ["L"] },
  stiffness: { elbow: 10, lumbar: 3, thoracic: 3, hip: 1.4 },
  hints: {
    start: sidedHints("L", { ...ACTIVE, "elbow.flex": 10 }, REST, TRUNK),
    end: sidedHints("L", { ...ACTIVE, "elbow.flex": 128 }, REST, TRUNK),
  },
  extraGoals: (body) => [
    lockAngle(body, "hip_L.flex", 70, 28),
    lockAngle(body, "hip_R.flex", 70, 28),
    lockAngle(body, "lumbar.flex", 4, 16),
  ],
  extraKeyGoals: (body) => ({
    end: [lockAngle(body, "elbow_L.flex", 122, 200)],
  }),
  extraContacts: {
    "bench.pad": { thigh_L: 0.06, thigh_R: 0.06, pelvis: 0.05, hand_R: 0.06 },
  },
  checks: () => [
    checkJointWithinAt(
      "elbow-extended",
      "Working arm starts hanging",
      "Start with the dumbbell off the floor, your elbow straight, and your arm directed down toward the ground.",
      "elbow_L.flex",
      "top",
      0,
      28,
    ),
    checkJointWithinAt(
      "elbow-flexed",
      "Working elbow fully flexes",
      "Curl the dumbbell upward in an arc by fully bending your elbow.",
      "elbow_L.flex",
      "bottom",
      85,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Concentration curl",
      "Keep your elbow braced against your inner thigh and lower until the elbow is straight again.",
      "elbow_L.flex",
      80,
    ),
    {
      id: "torso-forward",
      label: "Torso stays leaned forward",
      cue: "Lean forward at your hips and keep the rest of your body stationary while the forearm moves.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["hip_L.flex"]) - 70), 16, "° of hip drift"),
    },
    {
      id: "elbow-braced",
      label: "Elbow stays braced",
      cue: "Keep the back of your elbow pinned against the inside of your thigh.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["shoulder_L.elev"]) - 58), 16, "° of upper-arm drift"),
    },
    {
      id: "underhand-grip",
      label: "Underhand grip held throughout",
      cue: "Hold the dumbbell with an underhand grip so the palm angles forward and in.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -45, "° of forearm pronation"),
    },
  ],
});
