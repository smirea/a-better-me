import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

/** Lying straight-bar skull crusher. Elbows point at the ceiling; the bar stops short of the forehead. */
const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -8,
  "clavicle.elev": 4,
};

const ARMS = {
  "shoulder.elev": 92,
  "shoulder.plane": 20,
  "shoulder.twist": 12,
  "forearm.pron": 70,
  "wrist.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "barbell-skull-crusher",
  catalogId: "1a15c6f170d88029a037f1c1bea19636",
  name: "Barbell Skull Crusher",
  defaultLoadKg: 16,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Forehead", "Press", "Lockout"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.3, top: 0.4 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.2,
    heelZ: 0.42,
    feetOnFloor: true,
  },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.2,
    anchor: "press",
    alignWrists: false,
  },
  extraContacts: { bar: { head: 0.07, neck: 0.04 } },
  stiffness: { shoulder: 1.2, elbow: 3, lumbar: 5, thoracic: 5 },
  hints: {
    start: { ...TRUNK, ...ARMS, "elbow.flex": 6 },
    end: { ...TRUNK, ...ARMS, "elbow.flex": 120 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.06, 0.28, 0.0], 20, "xz"),
    holdElbowNearShoulder(body, "R", [0.06, 0.28, 0.0], 20, "xz"),
  ],
  checks: () => [
    checkFeetPlanted("Keep the feet on the floor with the knees bent."),
    checkJointWithinAt(
      "elbows-locked",
      "Arms start vertical",
      "Press the bar up until the elbows are straight and the arms point at the ceiling.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "forehead",
      "Bar stops at the forehead",
      "Finish lowering the bar just before it reaches the forehead.",
      "elbow_L.flex",
      "bottom",
      95,
      140,
    ),
    checkJointRange(
      "elbow-rom",
      "Forearms hinge at fixed elbows",
      "Keep the upper arms vertical so only the elbows move.",
      "elbow_L.flex",
      80,
    ),
    {
      id: "overhand-grip",
      label: "Near shoulder-width overhand grip",
      cue: "Grasp the bar with a near shoulder-width overhand grip so the palms face back toward you.",
      evaluate: (context) =>
        everyFrame(
          context,
          (_, angles) => Math.abs(deg(angles["forearm_L.pron"]) - 70),
          28,
          "° off an overhand grip",
        ),
    },
  ],
});
