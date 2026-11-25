import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointWithinAt } from "../postures";

/**
 * Supine on a flat bench between two low cable columns, pressing as in a bench press.
 * `cable-dual` only builds a handle per side, so each hand holds a D-handle at
 * bench-press width instead of one straight bar clipped to both cables.
 */
const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -18,
  "clavicle.elev": -2,
};

const ARMS_TOP = {
  "shoulder.elev": 90,
  "shoulder.plane": 70,
  "shoulder.twist": 18,
  "elbow.flex": 6,
  "forearm.pron": 8,
  "wrist.flex": -4,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 56,
  "shoulder.plane": -4,
  "shoulder.twist": 12,
  "elbow.flex": 110,
  "forearm.pron": 72,
  "wrist.flex": -4,
};

export const spec = buildExerciseSpec({
  id: "dual-cable-bar-bench-press",
  catalogId: "3965c6f170d8807faa9de3abc977a2ac",
  name: "Dual Cable Bar Bench Press",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Chest"],
  tempo: { lower: 2, bottom: 0.25, raise: 1.2, top: 0.45 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.2,
    heelZ: 0.42,
    feetOnFloor: true,
  },
  apparatus: {
    kind: "cable-dual",
    pulleyY: 0.42,
    halfWidth: 0.95,
    z: -0.05,
    attachment: "d-handle",
    anchor: "press",
  },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.7, elbow: 8, lumbar: 5, thoracic: 5, clavicle: 3.5 },
  checks: () => [
    checkFeetPlanted("Keep both feet flat on the floor and the buttocks, upper back, and head on the bench."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows finish nearly straight",
      "Press until the elbows are nearly straight and the hands are over the shoulders.",
      "elbow_L.flex",
      "start",
      0,
      42,
    ),
    checkJointWithinAt(
      "chest",
      "Handles meet the lower chest",
      "Lower until the hands are about level with the lower chest, elbows stacked under the wrists.",
      "elbow_L.flex",
      "peak",
      85,
      130,
    ),
    checkAnchorTravel(
      "hands-rise",
      "Hands travel up from the chest",
      "Press up from the chest until the arms point toward the ceiling.",
      "press_L",
      "y",
      0.16,
    ),
  ],
});
