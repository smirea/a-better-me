import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, pin } from "../solver";
import { Vector3 } from "three";

/** Two kettlebells in the front rack, palms in, then both elbows flare as they press. */
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
  "shoulder.plane": 46,
  "shoulder.twist": 6,
  "elbow.flex": 98,
  "forearm.pron": 10,
  "wrist.flex": 4,
};

const LOCK = {
  "clavicle.elev": 18,
  "clavicle.prot": 2,
  "shoulder.elev": 166,
  "shoulder.plane": 26,
  "shoulder.twist": 4,
  "elbow.flex": 6,
  "forearm.pron": 52,
  "wrist.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "standing-kettlebell-overhead-press",
  catalogId: "1a05c6f170d880d983adf3f27171db52",
  name: "Standing Kettlebell Overhead Press",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Rack"],
  station: { kind: "standing", stanceX: 0.2, heelZ: 0.18, toeOutDeg: 14, balanceZ: 0.22 },
  apparatus: { kind: "kettlebells", sides: ["L", "R"], hangVertical: false },
  hints: {
    start: { ...TRUNK, ...RACK },
    end: { ...TRUNK, ...LOCK, "neck.flex": -2, "root.pitch": 2 },
  },
  stiffness: { knee: 2.8, elbow: 3, shoulder: 1.2 },
  extraGoals: (body) => [
    lockAngle(body, "knee_L.flex", 5, 20),
    lockAngle(body, "knee_R.flex", 5, 20),
    pin(body, "pelvisBottom", () => new Vector3(0, 0.85, 0.16), 36, "z"),
  ],
  checks: () => [
    checkFlatBack(
      "Keep a proud chest and the natural curve of the lower back. Do not lean back to finish the press.",
      16,
    ),
    checkFeetPlanted("Squeeze the glutes and brace the core with both feet planted."),
    checkJointWithinAt(
      "knees-straight",
      "Legs stay straight",
      "Keep the knees straight. The kettlebells stay against the forearms.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows lock out overhead",
      "Finish with both arms straight up and the biceps by the ears.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkAnchorTravel(
      "bells-rise",
      "Kettlebells travel upward",
      "Press both kettlebells from the front rack until the arms point at the ceiling.",
      "grip_L",
      "y",
      0.35,
    ),
    checkJointRange(
      "shoulder-rom",
      "Shoulders abduct overhead",
      "Flare the elbows out while pressing so the palms turn forward by lockout.",
      "shoulder_L.elev",
      70,
    ),
  ],
});
