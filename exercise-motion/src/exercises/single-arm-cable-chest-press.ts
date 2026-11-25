import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.z": 0.1,
  "knee.flex": 14,
  "hip.flex": 8,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
};

const ACTIVE_OPEN = {
  "shoulder.elev": 70,
  "shoulder.plane": -32,
  "shoulder.twist": 16,
  "elbow.flex": 86,
  "forearm.pron": 55,
  "wrist.flex": 0,
  "clavicle.prot": -8,
  "clavicle.elev": 2,
};

const ACTIVE_PRESS = {
  "shoulder.elev": 86,
  "shoulder.plane": 76,
  "shoulder.twist": 18,
  "elbow.flex": 8,
  "forearm.pron": 50,
  "wrist.flex": 0,
  "clavicle.prot": 6,
  "clavicle.elev": 4,
};

const REST = {
  "shoulder.elev": 14,
  "shoulder.plane": 16,
  "elbow.flex": 10,
  "forearm.pron": 20,
  "wrist.flex": 0,
  "clavicle.elev": 0,
  "clavicle.prot": 0,
};

export const spec = buildExerciseSpec({
  id: "single-arm-cable-chest-press",
  catalogId: "1a05c6f170d880c6a9d7d586318bbb31",
  name: "Single Arm Cable Chest Press",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Open", "Stretch"],
  tempo: { lower: 1.6, bottom: 0.25, raise: 1.3, top: 0.3 },
  station: {
    kind: "standing",
    stanceX: 0.12,
    split: { frontSide: "R", frontZ: 0.2, rearZ: -0.16, rearMode: "flat" },
    balanceZ: false,
  },
  apparatus: {
    kind: "cable-single",
    pulley: [0.72, 1.12, -0.45],
    columnPos: [0.85, -0.55],
    facingDir: 1,
    attachment: "d-handle",
    sides: ["L"],
  },
  stiffness: { elbow: 3, shoulder: 0.7, lumbar: 8, knee: 4 },
  hints: {
    start: sidedHints("L", ACTIVE_OPEN, REST, TRUNK),
    end: sidedHints("L", ACTIVE_PRESS, REST, TRUNK),
  },
  checks: () => [
    checkFlatBack("Keep the chest and hips facing forward so the cable does not twist the trunk."),
    checkJointWithinAt(
      "elbow-back",
      "Elbow starts behind the torso",
      "Let the cable pull the working elbow back behind the torso before you press.",
      "elbow_L.flex",
      "start",
      60,
      115,
    ),
    checkJointWithinAt(
      "elbow-straight",
      "Arm finishes outstretched",
      "Press the handle forward until the elbow is straight and the wrist stays stacked over it.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointRange(
      "press-rom",
      "The arm presses from behind the torso to in front",
      "Drive the elbow forward and inward, then let it arc back out.",
      "shoulder_L.plane",
      50,
    ),
  ],
});
