import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

/** Flat bench, palms in, kettlebell handles across the palms. */
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
  "shoulder.plane": 8,
  "shoulder.twist": 8,
  "elbow.flex": 110,
  "forearm.pron": 6,
  "wrist.flex": -4,
};

export const spec = buildExerciseSpec({
  id: "kettlebell-bench-press",
  catalogId: "1a05c6f170d8806b87edcb2d2e547481",
  name: "Kettlebell Bench Press",
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
  apparatus: { kind: "kettlebells", sides: ["L", "R"], hangVertical: false },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.7, elbow: 4, lumbar: 5, thoracic: 5, clavicle: 3.5 },
  checks: () => [
    checkFeetPlanted("Keep both feet flat on the floor, with the buttocks, upper back, and head on the bench."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked out",
      "Press until the arms point up and the elbows are straight over the shoulders.",
      "elbow_L.flex",
      "start",
      0,
      24,
    ),
    checkJointWithinAt(
      "chest",
      "Bells lower beside the chest",
      "Lower through the range the shoulders allow, with the wrists stacked over the elbows.",
      "elbow_L.flex",
      "peak",
      85,
      130,
    ),
    checkJointRange(
      "shoulder-rom",
      "Shoulders move through the press",
      "Drive the elbows up and in, then lower them out and down.",
      "shoulder_L.elev",
      18,
    ),
    checkAnchorTravel(
      "bells-rise",
      "Kettlebells travel up",
      "Press the kettlebells up from the chest.",
      "grip_L",
      "y",
      0.16,
    ),
  ],
});
