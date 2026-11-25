import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * Stand on a long band and shrug straight up toward the ears.
 * Arms stay long; the band is anchored under the midfoot.
 */
const ARMS = {
  "shoulder.elev": 12,
  "shoulder.plane": 18,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 8,
  "wrist.flex": 2,
  "clavicle.prot": 0,
};

export const spec = buildExerciseSpec({
  id: "band-shrug",
  catalogId: "3315c6f170d880ed991de6eed4888002",
  name: "Band Shrug",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Shrug", "Ears", "Lower", "Depressed"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.3, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: {
    kind: "band",
    anchors: [
      [-0.16, 0.02, 0.04],
      [0.16, 0.02, 0.04],
    ],
  },
  stiffness: { elbow: 6, shoulder: 1.4, lumbar: 8, clavicle: 1.2 },
  progress: (body, frame) => anchorPoint(body, frame, "grip_L").y,
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "clavicle.elev": -6 },
    end: { ...POSTURE_HINTS.standing, ...ARMS, "clavicle.elev": 26, "shoulder.elev": 16 },
  },
  checks: () => [
    checkFlatBack(
      "Stand on the middle of a long band and shrug the shoulders straight up while the legs and torso stay still.",
    ),
    checkNeutralNeck("Look straight ahead so the neck stays near the position you use when standing at rest."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Keep the elbows nearly straight and lift the shoulders toward the ears instead of bending the arms.",
      "elbow_L.flex",
      "peak",
      0,
      18,
    ),
    checkJointWithinAt(
      "shoulders-up",
      "Shoulders finish elevated",
      "Shrug straight up toward the ears through the available shoulder-girdle range.",
      "clavicle_L.elev",
      "peak",
      16,
      36,
    ),
    checkJointRange(
      "scapular-elevation",
      "Shoulder girdle elevates",
      "Let the band depress the shoulders, then elevate them straight up and lower under control.",
      "clavicle_L.elev",
      18,
    ),
  ],
});
