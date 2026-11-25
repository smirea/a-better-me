import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Front-rack kettlebell: bell on the forearm, palm in, then the elbow flares as it presses. */
const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 3,
  "lumbar.flex": -3,
  "hip.flex": 4,
  "knee.flex": 4,
  "ankle.dorsi": 2,
  "neck.flex": 6,
};

const RACK = {
  "clavicle.elev": 6,
  "clavicle.prot": -4,
  "shoulder.elev": 58,
  "shoulder.plane": 82,
  "shoulder.twist": 6,
  "elbow.flex": 98,
  "forearm.pron": 8,
  "wrist.flex": 4,
};

const LOCK = {
  "clavicle.elev": 18,
  "clavicle.prot": 2,
  "shoulder.elev": 168,
  "shoulder.plane": 28,
  "shoulder.twist": 4,
  "elbow.flex": 6,
  "forearm.pron": 55,
  "wrist.flex": 2,
};

const FREE = {
  "clavicle.elev": 2,
  "shoulder.elev": 14,
  "shoulder.plane": 24,
  "elbow.flex": 16,
  "forearm.pron": 20,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "standing-single-arm-kettlebell-overhead-press",
  catalogId: "1a05c6f170d88060b7f3f259ca3140b0",
  name: "Standing Single Arm Kettlebell Overhead Press",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Rack"],
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 10, balanceZ: 0.06 },
  apparatus: { kind: "kettlebells", sides: ["L"], hangVertical: false },
  hints: {
    start: sidedHints("L", RACK, FREE, TRUNK),
    end: sidedHints("L", LOCK, FREE, { ...TRUNK, "neck.flex": -2, "root.pitch": 2 }),
  },
  stiffness: { knee: 2.8, elbow: 3, shoulder: 1.2 },
  extraGoals: (body) => [lockAngle(body, "knee_L.flex", 5, 20), lockAngle(body, "knee_R.flex", 5, 20)],
  checks: () => [
    checkFlatBack(
      "Keep a proud chest and the natural curve of the lower back. Do not lean back to finish the press.",
      16,
    ),
    checkFeetPlanted("Squeeze the glutes and brace the core. Keep the knees straight."),
    checkJointWithinAt(
      "knees-straight",
      "Legs stay straight",
      "Keep the knees and wrists straight. The kettlebell stays against the forearm.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
    checkJointWithinAt(
      "elbows-locked",
      "Elbow locks out overhead",
      "Finish with the arm straight up, the elbow locked, and the biceps by the ear.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "overhead",
      "Bell finishes overhead",
      "Flare the elbow out while pressing so the palm faces forward at the top.",
      "shoulder_L.elev",
      "peak",
      140,
      175,
    ),
    checkAnchorTravel(
      "bell-rises",
      "Kettlebell travels upward",
      "Press the kettlebell from the front rack until the arm points at the ceiling.",
      "grip_L",
      "y",
      0.35,
    ),
    checkJointRange(
      "shoulder-rom",
      "Shoulder flexes and abducts",
      "The press is shoulder flexion, with the elbow flaring as the arm goes overhead.",
      "shoulder_L.elev",
      70,
    ),
  ],
});
