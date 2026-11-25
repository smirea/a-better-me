import { ALONG_Y, cylinder } from "../equipment";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Arms held straight out in front, about parallel to the floor, overhand. */
const ARMS = {
  "shoulder.elev": 72,
  "shoulder.plane": 62,
  "shoulder.twist": 10,
  "elbow.flex": 8,
  "forearm.pron": 76,
  "clavicle.elev": 10,
  "clavicle.prot": 6,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
};

const CURL = { ...ARMS, "wrist.flex": 28 };
const OPEN = { ...ARMS, "wrist.flex": -22 };

export const spec = buildExerciseSpec({
  id: "wrist-roller-wrist-curl-with-arms-raised",
  catalogId: "1ed5c6f170d880b299c9dfc5a8b8e76a",
  name: "Wrist Roller Wrist Curl With Arms Raised",
  defaultLoadKg: 3,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "hang",
  phaseLabels: ["Curl", "Switch", "Curl", "Open"],
  tempo: { lower: 0.7, bottom: 0.12, raise: 0.7, top: 0.12 },
  station: { kind: "standing", stanceX: 0.16, balanceZ: 0.06 },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 0.2, 0.72],
    columnPos: [0.62, 0.85],
    facingDir: -1,
    attachment: "straight-bar",
    attachmentWidth: 0.34,
    gripX: 0.12,
  },
  extraEquipment: [cylinder("roller.plate", [0, 0.1, 0.72], 0.11, 0.045, "plate", ALONG_Y, false)],
  hints: {
    start: sidedHints("L", CURL, OPEN, TRUNK),
    end: sidedHints("L", OPEN, CURL, TRUNK),
  },
  checks: () => [
    checkJointRange(
      "wrist-curl",
      "Working wrist curls the roller",
      "While your arms stay out in front, curl one wrist toward you.",
      "wrist_L.flex",
      36,
    ),
    checkJointRange(
      "opposite-wrist",
      "The other wrist opens as the first curls",
      "Point the opposite palm down as you switch hands.",
      "wrist_R.flex",
      36,
    ),
    checkJointWithinAt(
      "arms-forward",
      "Arms stay raised in front",
      "Raise your arms out in front of you with straight elbows until they are about parallel to the ground, and keep them there.",
      "shoulder_L.elev",
      "start",
      55,
      100,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Keep the elbows straight while the wrists do the work.",
      "elbow_L.flex",
      "start",
      0,
      24,
    ),
  ],
});
