import { Vector3 } from "three";
import { buildExerciseSpec, lockTorsoPitch } from "../builders";
import { stabilityBall } from "../equipment-library";
import { checkJointRange, checkJointWithinAt, plantBothFeet } from "../postures";
import { lockAngle, pin } from "../solver";

const BALL_R = 0.32;
const BALL_Z = 0.1;

const HANDS = {
  "shoulder.elev": 78,
  "shoulder.plane": 38,
  "shoulder.twist": 22,
  "elbow.flex": 100,
  "forearm.pron": 8,
  "wrist.flex": 6,
};

/** Back arched over the ball, hips and low back supported, feet flat. */
const DOWN = {
  "root.y": 0.5,
  "root.z": 0.02,
  "root.pitch": -78,
  "lumbar.flex": -4,
  "thoracic.flex": -6,
  "neck.flex": 4,
  "hip.flex": 52,
  "hip.abd": 10,
  "knee.flex": 92,
  "ankle.dorsi": 6,
  ...HANDS,
};

const UP = {
  ...DOWN,
  "root.y": 0.58,
  "root.z": 0.06,
  "root.pitch": -58,
  "lumbar.flex": 16,
  "thoracic.flex": 28,
  "neck.flex": 16,
};

export const spec = buildExerciseSpec({
  id: "stability-ball-crunch",
  catalogId: "2a25c6f170d88080a2efd70028c576e7",
  name: "Stability Ball Crunch",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  brace: true,
  phaseLabels: ["Arch", "Curl", "Peak", "Lower"],
  station: { kind: "cardio", machine: "none" },
  extraEquipment: stabilityBall(BALL_R, [0, BALL_Z]),
  extraContacts: {
    "ball.body": {
      pelvis: 0.08,
      abdomen: 0.06,
      chest: 0.06,
      girdle: 0.06,
      head: 0.04,
      thigh_L: 0.07,
      thigh_R: 0.07,
    },
  },
  extraGoals: (body) => [
    ...plantBothFeet(body, 0.16, 0.62, 0.12, 0, 44),
    pin(body, "sacrum", () => new Vector3(0, BALL_R * 2 - 0.04, BALL_Z), 36),
    lockAngle(body, "lumbar.flex", -10, 10),
  ],
  extraKeyGoals: (body) => ({
    start: [lockTorsoPitch(body, -90, 22)],
    end: [lockTorsoPitch(body, -62, 20)],
  }),
  extraRequired: [
    { label: "Low back on ball", anchor: "sacrum", part: "ball.body", allowSlide: true },
    { label: "Left foot planted", anchor: "heel_L", surfaceY: 0 },
    { label: "Right foot planted", anchor: "heel_R", surfaceY: 0 },
  ],
  apparatus: { kind: "none" },
  stiffness: { lumbar: 8, thoracic: 8, hip: 6, knee: 6 },
  hints: { start: DOWN, end: UP },
  checks: () => [
    checkJointRange(
      "spine-curls",
      "The spine curls the ribs toward the hips",
      "Curl your spine as you pull the bottom of your ribs toward the tops of your hip bones and lift your upper back off the ball.",
      "thoracic.flex",
      12,
    ),
    checkJointWithinAt(
      "starts-arched",
      "The back starts arched over the ball",
      "Walk your feet forward until your back is resting on the ball and allow your back to arch naturally.",
      "thoracic.flex",
      "start",
      -22,
      8,
    ),
    checkJointWithinAt(
      "hips-stay",
      "Hips stay supported on the ball",
      "Keep your hip bones and lower back against the ball while your shoulder blades rise above it.",
      "hip_L.flex",
      "peak",
      20,
      80,
    ),
    checkJointWithinAt(
      "hands-at-head",
      "Fingertips stay beside the head",
      "Place the fingertips of each hand lightly beside the back of your head, with your elbows directed out.",
      "elbow_L.flex",
      "peak",
      75,
      125,
    ),
  ],
});
