import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { pullUpStation } from "../equipment-library";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, pin } from "../solver";
import { Vector3 } from "three";

const ARMS = {
  "clavicle.elev": 10,
  "clavicle.prot": 6,
  "shoulder.elev": 148,
  "shoulder.plane": 72,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 40,
  "wrist.flex": 4,
};

/** Upright kneel: thigh and torso are one vertical line, tops of the feet on the mat. */
const UP = {
  ...POSTURE_HINTS.kneeling,
  "root.y": 0.52,
  "root.z": 0.02,
  "root.pitch": 2,
  "hip.flex": 6,
  "hip.abd": 6,
  "knee.flex": 96,
  "ankle.dorsi": -12,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
  ...ARMS,
};

/** Lean back as one line. Knees bend; hips stay open so the thigh and torso stay aligned. */
const BACK = {
  ...UP,
  "root.y": 0.38,
  "root.z": -0.08,
  "root.pitch": -38,
  "hip.flex": 6,
  "knee.flex": 136,
};

const BAR_Y = 2.2;
const BAR_Z = 0.85;

export const spec = buildExerciseSpec({
  id: "band-assisted-reverse-nordic-curl",
  catalogId: "2085c6f170d88005840bc8e62d211380",
  name: "Band-Assisted Reverse Nordic Curl",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lean", "Back", "Rise", "Tall"],
  tempo: { lower: 2.2, bottom: 0.25, raise: 1.8, top: 0.3 },
  station: { kind: "kneeling", mat: true },
  apparatus: {
    kind: "band",
    anchors: [
      [0.2, BAR_Y, BAR_Z],
      [-0.2, BAR_Y, BAR_Z],
    ],
    targetAnchors: ["grip_L", "grip_R"],
  },
  extraEquipment: pullUpStation(BAR_Y, BAR_Z, 0.9).parts,
  stiffness: { hip: 8, lumbar: 12, thoracic: 10, knee: 2, elbow: 8, ankle: 8 },
  hints: { start: UP, end: BACK },
  extraGoals: (body) => [
    lockAngle(body, "hip_L.flex", 6, 28),
    lockAngle(body, "hip_R.flex", 6, 28),
    lockAngle(body, "lumbar.flex", 4, 16),
    lockAngle(body, "elbow_L.flex", 8, 16),
    lockAngle(body, "elbow_R.flex", 8, 16),
    pin(body, "toe_L", () => new Vector3(0.14, 0.055, -0.4), 64, "y"),
    pin(body, "toe_R", () => new Vector3(-0.14, 0.055, -0.4), 64, "y"),
  ],
  checks: () => [
    checkJointWithinAt(
      "upright-start",
      "Starts tall on the knees",
      "Kneel upright with the arms aligned with the band and the elbows straight.",
      "knee_L.flex",
      "start",
      80,
      115,
    ),
    checkJointWithinAt(
      "lean-back",
      "Torso leans back from the knees",
      "Lean backward by bending only at the knees, as far as strength and the band allow.",
      "knee_L.flex",
      "peak",
      118,
      160,
    ),
    checkJointWithinAt(
      "hips-open",
      "Thighs and torso stay in one line",
      "Keep the hips open so you can draw a straight line from the thigh through the hip to the torso.",
      "hip_L.flex",
      "peak",
      -8,
      22,
    ),
    checkJointRange(
      "knee-rom",
      "Knees bend and extend through the lean",
      "The motion comes from the knees. Rise back to a fully upright kneel.",
      "knee_L.flex",
      28,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Arms stay long on the band",
      "Hold the band with straight elbows and keep the arms aligned with the band.",
      "elbow_L.flex",
      "peak",
      0,
      24,
    ),
  ],
});
