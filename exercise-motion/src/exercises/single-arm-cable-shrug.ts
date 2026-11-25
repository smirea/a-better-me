import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Vertical single-arm shrug: the cable depresses the working shoulder, then it rises toward the ear. */
const DOWN = {
  "shoulder.elev": 16,
  "shoulder.plane": 14,
  "shoulder.twist": 2,
  "elbow.flex": 8,
  "forearm.pron": 4,
  "wrist.flex": 0,
  "clavicle.elev": -8,
  "clavicle.prot": 4,
};

const UP = {
  ...DOWN,
  "shoulder.elev": 18,
  "clavicle.elev": 26,
  "clavicle.prot": 0,
};

const REST = {
  "shoulder.elev": 12,
  "shoulder.plane": 16,
  "elbow.flex": 10,
  "forearm.pron": 8,
  "clavicle.elev": 0,
  "clavicle.prot": 0,
};

export const spec = buildExerciseSpec({
  id: "single-arm-cable-shrug",
  catalogId: "3065c6f170d8802ba1e2d2055f8bd410",
  name: "Single Arm Cable Shrug",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Shrug", "Ear", "Lower", "Depressed"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.2, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0.55, 0.18, 0.02],
    columnPos: [0.78, 0.02],
    facingDir: 1,
    attachment: "d-handle",
    sides: ["L"],
  },
  stiffness: { elbow: 6, lumbar: 8, clavicle: 1.1 },
  progress: (body, frame) => anchorPoint(body, frame, "grip_L").y,
  hints: {
    start: sidedHints("L", DOWN, REST, { ...POSTURE_HINTS.standing, "knee.flex": 8 }),
    end: sidedHints("L", UP, REST, { ...POSTURE_HINTS.standing, "knee.flex": 8 }),
  },
  checks: () => [
    checkFlatBack(
      "Keep the chest up and the torso upright. Do not let the cable bend the trunk toward the pulley.",
    ),
    checkNeutralNeck("Look straight ahead so the neck stays near neutral."),
    checkJointWithinAt(
      "elbow-straight",
      "Elbow stays straight",
      "Without bending the elbow, shrug the shoulder up toward the earlobe.",
      "elbow_L.flex",
      "peak",
      0,
      20,
    ),
    checkJointWithinAt(
      "shoulder-up",
      "Working shoulder finishes elevated",
      "At the top the working shoulder is higher than the resting shoulder.",
      "clavicle_L.elev",
      "peak",
      16,
      36,
    ),
    checkJointRange(
      "scapular-elevation",
      "Shoulder girdle elevates",
      "Let the cable pull the shoulder down, then shrug it fully up and lower under control.",
      "clavicle_L.elev",
      18,
    ),
  ],
});
