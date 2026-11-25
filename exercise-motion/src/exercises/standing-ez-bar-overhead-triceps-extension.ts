import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { deg } from "../math";
import { checkFlatBack, checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Standing French press, option 1: upper arms stay vertical and the EZ bar arcs behind the head. */
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
  id: "standing-ez-bar-overhead-triceps-extension",
  catalogId: "1a15c6f170d88047b7a9c99076376323",
  name: "Standing EZ Bar Overhead Triceps Extension",
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
    style: "ez",
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
      "Keep the lower back and neck near neutral, like standing upright and looking ahead, while the bar moves behind the head.",
    ),
    checkFeetPlanted("Stand in a near shoulder-width stance and keep the feet planted."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows start straight overhead",
      "Start with the elbows fully straightened and the bar vertically stacked above the shoulders.",
      "elbow_L.flex",
      "top",
      0,
      36,
    ),
    checkJointWithinAt(
      "elbows-bent",
      "Bar lowers behind the head",
      "Bend the elbows until they are fully flexed or the bar can lightly reach the base of the neck.",
      "elbow_L.flex",
      "bottom",
      105,
      145,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows extend the EZ bar overhead",
      "Straighten the elbows to lift the bar back overhead.",
      "elbow_L.flex",
      85,
    ),
    {
      id: "elbows-stay-up",
      label: "Upper arms stay overhead",
      cue: "Keep the elbows completely up with the upper arms vertical so the bar arcs only from the forearms.",
      evaluate: (context) => {
        const vals = context.angles.map((a) => deg(a["shoulder_L.elev"]));
        const lo = Math.min(...vals);
        const hi = Math.max(...vals);
        return {
          pass: lo >= 145 && hi - lo <= 28,
          measured: `shoulder elevation ${lo.toFixed(0)}°–${hi.toFixed(0)}°`,
        };
      },
    },
  ],
});
