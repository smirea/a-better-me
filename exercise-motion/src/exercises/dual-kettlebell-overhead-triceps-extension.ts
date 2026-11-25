import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

/** Two kettlebells overhead, elbows tucked and pointing forward, bells lowering behind the head. */
const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "lumbar.flex": -2,
  "thoracic.flex": -2,
  "hip.flex": 4,
  "knee.flex": 4,
  "neck.flex": 4,
};

const ARMS = {
  "clavicle.elev": 16,
  "clavicle.prot": 0,
  "shoulder.elev": 166,
  "shoulder.plane": 12,
  "shoulder.twist": 4,
  "forearm.pron": 68,
  "wrist.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "dual-kettlebell-overhead-triceps-extension",
  catalogId: "1a15c6f170d880f7b41ed136238884a6",
  name: "Dual Kettlebell Overhead Triceps Extension",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Lower", "Behind head", "Press", "Lockout"],
  tempo: { lower: 1.8, bottom: 0.3, raise: 1.4, top: 0.4 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 8 },
  apparatus: { kind: "kettlebells", sides: ["L", "R"], hangVertical: false },
  hints: {
    start: { ...TRUNK, ...ARMS, "elbow.flex": 6 },
    end: { ...TRUNK, ...ARMS, "elbow.flex": 128, "neck.flex": 10 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.04, 0.26, 0.02], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.04, 0.26, 0.02], 16, "xz"),
  ],
  checks: () => [
    checkFlatBack(
      "Keep the chest up and the lower back in its natural curve while the kettlebells move behind the head.",
    ),
    checkFeetPlanted("Stand in a near hip-width stance and keep the feet planted."),
    checkJointWithinAt(
      "elbows-locked",
      "Arms start straight overhead",
      "Finish the press with the arms directed up, the elbows straight, and the biceps by the ears.",
      "elbow_L.flex",
      "top",
      0,
      42,
    ),
    checkJointWithinAt(
      "elbows-bent",
      "Bells lower behind the head",
      "Bend the elbows until they are fully flexed or the bells can lightly reach the back of the shoulders.",
      "elbow_L.flex",
      "bottom",
      105,
      145,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows extend the kettlebells",
      "Straighten the elbows to lift the kettlebells back overhead without dropping the shoulders.",
      "elbow_L.flex",
      85,
    ),
    checkJointWithinAt(
      "elbows-up",
      "Elbows stay overhead",
      "Keep the elbows up and chiefly pointing forward. Movement comes from the forearms hinging.",
      "shoulder_L.elev",
      "bottom",
      145,
      178,
    ),
  ],
});
