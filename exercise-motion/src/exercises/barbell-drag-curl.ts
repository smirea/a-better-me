import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Underhand drag curl: elbows travel behind the torso so the bar rises in a near-vertical line. */
const GRIP = {
  "shoulder.twist": -12,
  "forearm.pron": -76,
  "wrist.flex": 4,
  "clavicle.elev": 2,
};

export const spec = buildExerciseSpec({
  id: "barbell-drag-curl",
  catalogId: "1a15c6f170d880169a4dd5ff44c08a34",
  name: "Barbell Drag Curl",
  defaultLoadKg: 14,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Drag", "Peak", "Lower", "Hang"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    alignWrists: false,
    // Bar stays in front of the ribs and rises almost straight up while the elbows travel back.
    path: { startY: 0.7, startZ: 0.3, endY: 1.16, endZ: 0.32, arcBulgeZ: -0.015 },
  },
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      ...GRIP,
      "shoulder.elev": 14,
      "shoulder.plane": 50,
      "clavicle.prot": 2,
      "elbow.flex": 8,
    },
    end: {
      ...POSTURE_HINTS.standing,
      ...GRIP,
      "shoulder.elev": 28,
      "shoulder.plane": -32,
      "clavicle.prot": -14,
      "elbow.flex": 128,
    },
  },
  stiffness: { lumbar: 12, thoracic: 10, hip: 8, knee: 8 },
  extraGoals: (body) => [
    lockAngle(body, "hip_L.flex", 4, 28),
    lockAngle(body, "hip_R.flex", 4, 28),
    lockAngle(body, "lumbar.flex", 0, 22),
    lockAngle(body, "knee_L.flex", 4, 18),
    lockAngle(body, "knee_R.flex", 4, 18),
  ],
  checks: () => [
    checkFlatBack("Stay upright. The bar travels straight up while your elbows drive back, not your torso."),
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start extended",
      "Start upright with straight elbows and the bar in front of your thighs.",
      "elbow_L.flex",
      "top",
      -4,
      24,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows fully flex with the arms behind you",
      "Finish with your elbows fully flexed and your upper arms behind your torso.",
      "elbow_L.flex",
      "bottom",
      100,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows flex through the drag",
      "Curl the bar upward by bending at your elbows while driving your upper arms back.",
      "elbow_L.flex",
      95,
    ),
    checkJointWithinAt(
      "elbows-back",
      "Upper arms finish behind the torso",
      "Drive your upper arms back behind your torso so the bar rises in a straight line.",
      "shoulder_L.plane",
      "bottom",
      -85,
      -8,
    ),
    {
      id: "underhand-grip",
      label: "Underhand grip held throughout",
      cue: "Grasp the bar with a shoulder-width underhand grip so your palms face forward.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -50, "° of forearm pronation"),
    },
  ],
});
