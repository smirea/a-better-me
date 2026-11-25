import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";

/**
 * Seated, leaned forward, legs apart. The working elbow stays braced on the inner thigh.
 * Hammer grip: palm faces back toward the torso.
 */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.52,
  "root.pitch": 18,
  "hip.flex": 78,
  "hip.abd": 30,
  "knee.flex": 84,
  "lumbar.flex": 8,
  "thoracic.flex": 10,
  "neck.flex": 16,
};

const WORK_DOWN = {
  "shoulder.elev": 36,
  "shoulder.plane": 100,
  "shoulder.twist": 8,
  "elbow.flex": 24,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": 10,
};

const WORK_UP = {
  ...WORK_DOWN,
  "elbow.flex": 128,
};

const FREE = {
  "shoulder.elev": 28,
  "shoulder.plane": 55,
  "shoulder.twist": 4,
  "elbow.flex": 48,
  "forearm.pron": 16,
  "wrist.flex": 6,
  "clavicle.elev": 2,
  "clavicle.prot": 2,
};

export const spec = buildExerciseSpec({
  id: "concentration-hammer-curl",
  catalogId: "3585c6f170d88032a92edeaaaac53bf6",
  name: "Concentration Hammer Curl",
  defaultLoadKg: 3,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Hang"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.46,
    stanceX: 0.38,
    heelZ: 0.38,
    frame: { type: "flat-bench" },
  },
  apparatus: { kind: "dumbbells", sides: ["L"] },
  hints: {
    start: sidedHints("L", WORK_DOWN, FREE, SEAT),
    end: sidedHints("L", WORK_UP, FREE, SEAT),
  },
  extraContacts: {
    "bench.pad": { thigh_L: 0.05, thigh_R: 0.05, thighShaft_L: 0.05, thighShaft_R: 0.05 },
  },
  checks: () => [
    checkJointWithinAt(
      "leaning-forward",
      "Torso stays leaned forward",
      "Lean forward at the hips so the elbow can brace against the inside of the thigh.",
      "hip_L.flex",
      "top",
      55,
      120,
    ),
    checkJointWithinAt(
      "elbow-extended",
      "Working elbow starts extended",
      "Start with the entire arm directed down toward the ground and the elbow straightened.",
      "elbow_L.flex",
      "top",
      0,
      28,
    ),
    checkJointWithinAt(
      "elbow-flexed",
      "Working elbow fully flexes",
      "Curl the dumbbell upward by fully bending the elbow while it stays pinned to the inner thigh.",
      "elbow_L.flex",
      "bottom",
      105,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Concentration hammer curl",
      "Lower the dumbbell until the elbow is fully straightened again, forearm directed down.",
      "elbow_L.flex",
      85,
    ),
    {
      id: "hammer-grip",
      label: "Hammer grip held throughout",
      cue: "Hold the dumbbell with a hammer grip that directs the palm back toward you, and do not rotate the palm.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["forearm_L.pron"])), 24, "° away from a neutral forearm"),
    },
    {
      id: "elbow-stays-down",
      label: "Elbow stays braced down by the thigh",
      cue: "Keep the back of the elbow against the inside of the thigh. The rest of the body stays still.",
      evaluate: (context) =>
        everyFrame(
          context,
          (frame) => {
            const elbow = frame.pos[context.body.index.elbow_L];
            const hip = frame.pos[context.body.index.hip_L];
            return Math.abs(elbow.y - hip.y) * 100;
          },
          18,
          " cm between the elbow and the hip height",
        ),
    },
  ],
});
