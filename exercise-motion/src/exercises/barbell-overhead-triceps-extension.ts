import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Standing barbell French press. Upper arms stay vertical; the straight bar hinges behind the head. */
const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 12,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "hip.flex": 16,
  "knee.flex": 4,
  "neck.flex": 6,
};

const ARMS = {
  "clavicle.elev": 14,
  "clavicle.prot": 2,
  "shoulder.elev": 158,
  "shoulder.plane": 58,
  "shoulder.twist": 6,
  "forearm.pron": 42,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "barbell-overhead-triceps-extension",
  catalogId: "1a15c6f170d880ac94cbc8d5a58b5f21",
  name: "Barbell Overhead Triceps Extension",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Behind head", "Press", "Lockout"],
  tempo: { lower: 2.6, bottom: 0.45, raise: 2.4, top: 0.5 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 8, torsoLeanDeg: 12 },
  stiffness: { knee: 4, hip: 3, elbow: 2.4, lumbar: 7 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.18,
    anchor: "press",
    alignWrists: false,
  },
  extraContacts: { bar: { head: 0.06, neck: 0.04 } },
  hints: {
    start: { ...TRUNK, ...ARMS, "elbow.flex": 6 },
    end: { ...TRUNK, ...ARMS, "elbow.flex": 118, "neck.flex": 12 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.06, 0.24, 0.0], 6, "xz"),
    holdElbowNearShoulder(body, "R", [0.06, 0.24, 0.0], 6, "xz"),
    lockAngle(body, "knee_L.flex", 5, 20),
    lockAngle(body, "knee_R.flex", 5, 20),
  ],
  checks: () => [
    checkFlatBack(
      "Keep the lower back and neck near neutral while the bar lowers behind the head.",
    ),
    checkFeetPlanted("Stand in a near shoulder-width stance and keep the feet planted."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows start straight overhead",
      "Press the bar overhead until the elbows are fully straightened and the bar is stacked over the shoulders.",
      "elbow_L.flex",
      "top",
      0,
      36,
    ),
    checkJointWithinAt(
      "elbows-bent",
      "Bar lowers behind the head",
      "Bend the elbows until they are fully flexed or the bar can lightly tap the base of the neck.",
      "elbow_L.flex",
      "bottom",
      100,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows extend the bar overhead",
      "Straighten the elbows to lift the bar back overhead.",
      "elbow_L.flex",
      85,
    ),
    {
      id: "overhand-grip",
      label: "Overhand grip",
      cue: "Grasp the bar with an overhand grip so the palms face backward.",
      evaluate: (context) =>
        everyFrame(
          context,
          (_, angles) => Math.abs(deg(angles["forearm_L.pron"]) - 70),
          40,
          "° off an overhand grip",
        ),
    },
  ],
});
