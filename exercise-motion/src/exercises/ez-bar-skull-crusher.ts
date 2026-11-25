import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { deg } from "../math";
import { checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

/** Lying EZ-bar skull crusher: upper arms stay vertical and the bar stops at the forehead. */
const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -8,
  "clavicle.elev": 4,
};

const ARMS = {
  "shoulder.elev": 92,
  "shoulder.plane": 22,
  "shoulder.twist": 10,
  "forearm.pron": 40,
  "wrist.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "ez-bar-skull-crusher",
  catalogId: "1a15c6f170d88003bf5cd77bef6a5034",
  name: "EZ Bar Skull Crusher",
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
    style: "ez",
    gripX: 0.18,
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
      "Start with the elbows straight and the arms directed straight up toward the ceiling.",
      "elbow_L.flex",
      "top",
      0,
      32,
    ),
    checkJointWithinAt(
      "forehead",
      "Bar stops at the forehead",
      "Finish lowering the bar just before it reaches the forehead, with the upper arms still vertical.",
      "elbow_L.flex",
      "bottom",
      95,
      140,
    ),
    checkJointRange(
      "elbow-rom",
      "Forearms hinge at fixed elbows",
      "All of the motion comes from the forearms hinging at the elbows.",
      "elbow_L.flex",
      80,
    ),
    {
      id: "elbows-fixed",
      label: "Upper arms stay vertical",
      cue: "Avoid letting the elbows drift back. When viewed from the side, the upper arms stay vertical.",
      evaluate: (context) => {
        const vals = context.angles.map((a) => deg(a["shoulder_L.elev"]));
        const lo = Math.min(...vals);
        const hi = Math.max(...vals);
        return {
          pass: hi - lo <= 24 && lo >= 55 && hi <= 115,
          measured: `shoulder elevation ${lo.toFixed(0)}°–${hi.toFixed(0)}°`,
        };
      },
    },
  ],
});
