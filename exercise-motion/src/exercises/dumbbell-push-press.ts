import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Neutral-grip rack. The dip and the catch share the same arm position; only the legs change. */
const ARMS = {
  "clavicle.elev": 8,
  "clavicle.prot": -8,
  "shoulder.elev": 68,
  "shoulder.plane": 80,
  "shoulder.twist": 4,
  "elbow.flex": 100,
  "forearm.pron": 2,
  "wrist.flex": 6,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 3,
  "lumbar.flex": -2,
  "thoracic.flex": 0,
  "neck.flex": 10,
  "hip.flex": 6,
  "knee.flex": 6,
  "ankle.dorsi": 2,
  ...ARMS,
};

const DIP = {
  ...STAND,
  "root.y": 0.84,
  "root.pitch": 4,
  "hip.flex": 28,
  "knee.flex": 34,
  "ankle.dorsi": 14,
  "neck.flex": 14,
};

const LOCKOUT = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "lumbar.flex": -2,
  "neck.flex": -4,
  "hip.flex": 4,
  "knee.flex": 4,
  "ankle.dorsi": 2,
  "clavicle.elev": 18,
  "clavicle.prot": 0,
  "shoulder.elev": 166,
  "shoulder.plane": 68,
  "shoulder.twist": 2,
  "elbow.flex": 6,
  "forearm.pron": 4,
  "wrist.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-push-press",
  catalogId: "1a05c6f170d880e58be2eda50377286f",
  name: "Dumbbell Push Press",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Dip", "Drive", "Lower", "Rack"],
  loopMode: "cycle",
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 12, trackKnees: 10, balanceZ: 0.08 },
  apparatus: { kind: "dumbbells", anchor: "press" },
  hints: { start: STAND, end: LOCKOUT },
  waypoints: [
    { hints: STAND, duration: 0.45, hold: 0.2 },
    { hints: DIP, duration: 0.4, hold: 0.06 },
    { hints: LOCKOUT, duration: 1.15, hold: 0.28 },
    { hints: DIP, duration: 0.85, hold: 0.08 },
  ],
  checks: () => [
    checkFlatBack(
      "Keep the lower back near neutral. Do not excessively arch it to finish the press.",
    ),
    checkFeetPlanted("Keep the soles of the feet in contact with the ground through the dip."),
    checkJointRange(
      "knee-dip",
      "Knees dip before the drive",
      "Bend the knees in a quarter squat while the torso stays upright and the arms stay quiet.",
      "knee_L.flex",
      18,
    ),
    checkJointWithinAt(
      "dip-depth",
      "Quarter-squat dip",
      "The dip is a shallow knee bend, not a full squat.",
      "knee_L.flex",
      "peak",
      22,
      55,
    ),
    checkJointRange(
      "elbows-locked",
      "Elbows lock out overhead",
      "After the leg drive, straighten the elbows with the dumbbells overhead.",
      "elbow_L.flex",
      70,
    ),
    checkJointRange(
      "overhead-lockout",
      "Arms finish overhead",
      "At the top the knees, hips, and elbows are straight and the bells sit over the shoulders.",
      "shoulder_L.elev",
      80,
    ),
  ],
});
