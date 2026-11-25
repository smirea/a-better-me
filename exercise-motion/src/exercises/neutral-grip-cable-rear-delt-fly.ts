import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/** Standing reverse fly. Arms start crossed in an X and open to a T, palms in. */
const STANCE = {
  ...POSTURE_HINTS.standing,
  "root.z": -0.12,
  "knee.flex": 8,
  "hip.flex": 6,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
};

const CROSSED = {
  "shoulder.elev": 74,
  "shoulder.plane": 84,
  "shoulder.twist": 6,
  "elbow.flex": 22,
  "forearm.pron": 8,
  "wrist.flex": 0,
  "clavicle.elev": 6,
  "clavicle.prot": 6,
};

const OPEN = {
  "shoulder.elev": 72,
  "shoulder.plane": 36,
  "shoulder.twist": 4,
  "elbow.flex": 20,
  "forearm.pron": 6,
  "wrist.flex": 0,
  "clavicle.elev": 10,
  "clavicle.prot": -12,
};

export const spec = buildExerciseSpec({
  id: "neutral-grip-cable-rear-delt-fly",
  catalogId: "1a15c6f170d880efa82beae1d5828f6c",
  name: "Neutral Grip Cable Rear Delt Fly",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Open", "T", "Return", "Cross"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.4, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: {
    kind: "cable-dual",
    pulleyY: 1.38,
    halfWidth: 0.92,
    z: 0.42,
    attachment: "d-handle",
    anchor: "grip",
  },
  stiffness: { elbow: 6, shoulder: 2.4, lumbar: 8, forearm: 4 },
  hints: {
    start: { ...STANCE, ...CROSSED },
    end: { ...STANCE, ...OPEN },
  },
  extraKeyGoals: (body) => ({
    start: [
      pin(body, "grip_L", () => new Vector3(-0.02, 1.52, 0.36), 16),
      pin(body, "grip_R", () => new Vector3(0.02, 1.1, 0.36), 16),
    ],
    end: [
      pin(body, "grip_L", () => new Vector3(0.46, 1.32, 0.16), 26),
      pin(body, "grip_R", () => new Vector3(-0.46, 1.32, 0.16), 26),
    ],
  }),
  checks: () => [
    checkFlatBack("Stand upright. All the motion comes from the shoulders, with the torso still."),
    checkJointWithinAt(
      "neutral-grip",
      "Neutral grip",
      "Grasp each D-handle with the palm facing the cable stack, and keep that neutral grip.",
      "forearm_L.pron",
      "peak",
      -25,
      35,
    ),
    checkJointWithinAt(
      "soft-elbows",
      "Elbows stay slightly bent",
      "Maintain slightly bent elbows throughout the set.",
      "elbow_L.flex",
      "peak",
      8,
      40,
    ),
    checkJointWithinAt(
      "t-shape",
      "Arms finish in a T",
      "Pull the handles out and back until the arms form a T with the torso.",
      "shoulder_L.plane",
      "peak",
      12,
      62,
    ),
    checkJointRange(
      "horizontal-abduction",
      "Arms sweep from an X to a T",
      "Open the crossed arms out to the sides, then return them until they cross again.",
      "shoulder_L.plane",
      50,
    ),
  ],
});
