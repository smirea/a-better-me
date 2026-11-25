import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { pullUpStation } from "../equipment-library";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Band anchored on a pull-up bar; elbows stay pinned at the ribs while the forearms press down. */
const ARMS = {
  "shoulder.elev": 18,
  "shoulder.plane": 28,
  "shoulder.twist": 8,
  "forearm.pron": 4,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": -4,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 12,
  "hip.flex": 16,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 6,
  "knee.flex": 8,
};

const station = pullUpStation(2.2, 0.42);

export const spec = buildExerciseSpec({
  id: "band-triceps-pushdown",
  catalogId: "2ce5c6f170d8809a8f3deb9e145171b0",
  name: "Band Triceps Pushdown",
  defaultLoadKg: 12,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Press", "Lockout", "Return", "Stretch"],
  tempo: { lower: 1.3, bottom: 0.3, raise: 1.6, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, heelZ: -0.02, torsoLeanDeg: 12, balanceZ: false },
  apparatus: {
    kind: "band",
    anchors: [
      [-0.06, station.barY, 0.42],
      [0.06, station.barY, 0.42],
    ],
  },
  extraEquipment: station.parts,
  hints: {
    start: { ...TRUNK, ...ARMS, "elbow.flex": 124 },
    end: { ...TRUNK, ...ARMS, "elbow.flex": 8 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.08, -0.28, 0.04], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.08, -0.28, 0.04], 16, "xz"),
  ],
  checks: () => [
    checkFlatBack(
      "Whether you are standing or kneeling, keep the shoulders, torso, and hips still while the forearms arc.",
    ),
    checkJointWithinAt(
      "elbows-bent",
      "Elbows start fully bent at the sides",
      "Grasp the ends of the band with your elbows fully bent by your sides and the band already taut.",
      "elbow_L.flex",
      "top",
      100,
      145,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows finish straight",
      "Push the ends of the band downward until the elbows are fully straightened.",
      "elbow_L.flex",
      "bottom",
      0,
      24,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows extend through the pushdown",
      "While keeping the elbows pinned by the sides, straighten them to press the band down.",
      "elbow_L.flex",
      85,
    ),
    {
      id: "neutral-grip",
      label: "Neutral grip on the band",
      cue: "Grasp the ends of the band with a neutral grip so the palms face in toward each other.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["forearm_L.pron"])), 28, "° from neutral"),
    },
  ],
});
