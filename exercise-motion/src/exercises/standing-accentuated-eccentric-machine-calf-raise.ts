import { Vector3 } from "three";
import { buildExerciseSpec, lockTorsoPitch, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { pin } from "../solver";

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.z": -0.02,
  "root.pitch": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
  "clavicle.elev": 6,
  "shoulder.elev": 12,
  "shoulder.plane": 18,
  "shoulder.twist": 8,
  "elbow.flex": 22,
  "forearm.pron": 16,
  "wrist.flex": 4,
};

const work = (ankle: number) => ({
  "hip.flex": 6,
  "hip.abd": 4,
  "knee.flex": 8,
  "ankle.dorsi": ankle,
});

const free = {
  "hip.flex": 70,
  "hip.abd": 16,
  "knee.flex": 100,
  "ankle.dorsi": 4,
};

export const spec = buildExerciseSpec({
  id: "standing-accentuated-eccentric-machine-calf-raise",
  catalogId: "2ab5c6f170d8801a9c0eef1917dc7993",
  name: "Standing Accentuated Eccentric Machine Calf Raise",
  defaultLoadKg: 18,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Raise", "Top", "Lower", "Stretch"],
  tempo: { lower: 3.0, bottom: 0.25, raise: 1.2, top: 0.35 },
  station: { kind: "calf-station", mode: "standing", stanceX: 0.1, singleFoot: "L" },
  apparatus: {
    kind: "roller-pad",
    trackAnchors: ["traps"],
    offset: [0, 0.05, -0.02],
    forceDir: [0, -1, 0],
    width: 0.42,
  },
  hints: {
    start: sidedHints("L", work(22), free, { ...TRUNK, "root.y": 1.02, "root.z": 0.0 }),
    end: sidedHints("L", work(-34), free, { ...TRUNK, "root.y": 1.12, "root.z": 0.0 }),
  },
  extraGoals: (body) => [
    lockTorsoPitch(body, 2, 30),
    pin(body, "pelvisBottom", () => new Vector3(0, 0, 0.02), 30, "xz"),
  ],
  stiffness: { knee: 5, ankle: 4, hip: 3, root: 6 },
  checks: () => [
    checkFlatBack("Stay upright under the shoulder pads. Do not fold at the lower back."),
    checkNeutralNeck("Keep the trunk upright and the neck near neutral."),
    checkJointWithinAt(
      "knees-straight",
      "Working knee stays straight",
      "Stand with straight knees. The working knee stays straight while that heel lowers.",
      "knee_L.flex",
      "start",
      0,
      14,
    ),
    checkJointRange(
      "ankle-rom",
      "Working heel lowers through a long range",
      "After both heels are up, lower the working heel below the ball of the foot.",
      "ankle_L.dorsi",
      32,
    ),
    checkJointWithinAt(
      "stretch",
      "Working heel finishes in a stretch",
      "Lower the working heel as far as calf flexibility allows. Do not bounce.",
      "ankle_L.dorsi",
      "start",
      6,
      32,
    ),
    checkJointWithinAt(
      "top",
      "Both heels are high at the top",
      "Push through the balls of both feet until the heels are fully up.",
      "ankle_L.dorsi",
      "peak",
      -45,
      -22,
    ),
  ],
});
