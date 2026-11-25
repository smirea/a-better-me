import { ALONG_Y, cylinder } from "../equipment";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Arms long toward the floor, overhand, roller in front of the thighs. */
const ARMS = {
  "shoulder.elev": 18,
  "shoulder.plane": 36,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 78,
  "clavicle.elev": 2,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "hip.flex": 6,
};

const CURL = { ...ARMS, "wrist.flex": 28 };
const OPEN = { ...ARMS, "wrist.flex": -22 };

const PLATE = cylinder("roller.plate", [0, 0.1, 0.58], 0.11, 0.045, "plate", ALONG_Y, false);

export const spec = buildExerciseSpec({
  id: "wrist-roller-wrist-curl-with-arms-directed-down",
  catalogId: "1a15c6f170d880c2bf39d2f4b0fd7b97",
  name: "Wrist Roller Wrist Curl With Arms Directed Down",
  defaultLoadKg: 3,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "hang",
  phaseLabels: ["Curl", "Switch", "Curl", "Open"],
  tempo: { lower: 0.7, bottom: 0.12, raise: 0.7, top: 0.12 },
  station: { kind: "standing", stanceX: 0.16, heelZ: -0.02, balanceZ: 0.08 },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 0.18, 0.58],
    columnPos: [0.55, 0.7],
    facingDir: -1,
    attachment: "straight-bar",
    attachmentWidth: 0.34,
    gripX: 0.1,
  },
  extraEquipment: [PLATE],
  hints: {
    start: sidedHints("L", CURL, OPEN, TRUNK),
    end: sidedHints("L", OPEN, CURL, TRUNK),
  },
  checks: () => [
    checkJointRange(
      "wrist-curl",
      "Working wrist curls the roller",
      "Bend one wrist to curl that hand toward you while the other wrist points the palm down.",
      "wrist_L.flex",
      36,
    ),
    checkJointRange(
      "opposite-wrist",
      "The other wrist opens as the first curls",
      "Alternate the twisting motion so one wrist flexes while the other extends.",
      "wrist_R.flex",
      36,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Keep your elbows straightened with your arms directed down toward the ground.",
      "elbow_L.flex",
      "start",
      0,
      24,
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip on the roller",
      "Grasp the roller with your palms facing toward you.",
      "forearm_L.pron",
      "start",
      36,
      90,
    ),
  ],
});
