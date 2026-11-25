import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/**
 * Stand on a long band and raise both arms forward to shoulder height.
 * Palms stay down; elbows stay straight. The band is anchored under the midfoot.
 */
const DOWN = {
  "shoulder.elev": 18,
  "shoulder.plane": 82,
  "shoulder.twist": 12,
  "elbow.flex": 6,
  "forearm.pron": 70,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

const UP = {
  ...DOWN,
  "shoulder.elev": 92,
  "shoulder.plane": 86,
  "clavicle.elev": 12,
  "clavicle.prot": 4,
};

export const spec = buildExerciseSpec({
  id: "band-front-raise",
  catalogId: "3315c6f170d880d296abfb90dbd5aa6b",
  name: "Band Front Raise",
  defaultLoadKg: 5,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Raise", "Shoulder height", "Lower", "Thighs"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.4, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: {
    kind: "band",
    anchors: [
      [-0.16, 0.02, 0.06],
      [0.16, 0.02, 0.06],
    ],
  },
  stiffness: { elbow: 6, shoulder: 0.7, lumbar: 8, thoracic: 7 },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...DOWN },
    end: { ...POSTURE_HINTS.standing, ...UP },
  },
  checks: () => [
    checkFlatBack(
      "Stand on the middle of a long band and raise both arms forward while the legs and torso stay still.",
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Keep the elbows straight and sweep the arms forward to shoulder height with the palms down.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "arms-down",
      "Arms start beside the thighs",
      "Start standing on the band with the arms directed down in front of the thighs.",
      "shoulder_L.elev",
      "start",
      4,
      36,
    ),
    checkJointWithinAt(
      "shoulder-height",
      "Arms finish near shoulder height",
      "Raise the arms until they are outstretched in front of you, about parallel to the ground.",
      "shoulder_L.elev",
      "peak",
      72,
      112,
    ),
    checkJointRange(
      "shoulder-flexion",
      "Shoulders flex through the raise",
      "Sweep the arms forward and upward in an arc, then lower them under control.",
      "shoulder_L.elev",
      50,
    ),
  ],
});
