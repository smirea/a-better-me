import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const WORK = {
  "clavicle.elev": 8,
  "clavicle.prot": -6,
  "shoulder.elev": 68,
  "shoulder.plane": 80,
  "shoulder.twist": 4,
  "elbow.flex": 100,
  "forearm.pron": 2,
  "wrist.flex": 6,
};

const REST = {
  "clavicle.elev": 6,
  "clavicle.prot": 4,
  "shoulder.elev": 70,
  "shoulder.plane": 80,
  "shoulder.twist": 6,
  "elbow.flex": 16,
  "forearm.pron": 8,
  "wrist.flex": 0,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 3,
  "root.roll": -4,
  "lumbar.flex": -2,
  "neck.flex": 10,
  "hip.flex": 6,
  "knee.flex": 6,
  "ankle.dorsi": 2,
};

const STAND = sidedHints("L", WORK, REST, TRUNK);

const DIP = sidedHints("L", WORK, REST, {
  ...TRUNK,
  "root.y": 0.84,
  "root.pitch": 4,
  "hip.flex": 28,
  "knee.flex": 34,
  "ankle.dorsi": 14,
  "neck.flex": 14,
});

const LOCKOUT = sidedHints(
  "L",
  {
    "clavicle.elev": 18,
    "clavicle.prot": 0,
    "shoulder.elev": 166,
    "shoulder.plane": 68,
    "shoulder.twist": 2,
    "elbow.flex": 6,
    "forearm.pron": 4,
    "wrist.flex": 2,
  },
  REST,
  {
    ...POSTURE_HINTS.standing,
    "root.pitch": 2,
    "lumbar.flex": -2,
    "neck.flex": -4,
    "hip.flex": 4,
    "knee.flex": 4,
    "ankle.dorsi": 2,
  },
);

export const spec = buildExerciseSpec({
  id: "single-arm-dumbbell-push-press",
  catalogId: "1a05c6f170d880dfbe8cd859723b5c99",
  name: "Single Arm Dumbbell Push Press",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "asymmetrical",
  activeSide: "L",
  grip: "press",
  phaseLabels: ["Dip", "Drive", "Lower", "Rack"],
  loopMode: "cycle",
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 12, trackKnees: 10, balanceZ: 0.08 },
  apparatus: { kind: "dumbbells", sides: ["L"], anchor: "press" },
  hints: { start: STAND, end: LOCKOUT },
  waypoints: [
    { hints: STAND, duration: 0.45, hold: 0.2 },
    { hints: DIP, duration: 0.4, hold: 0.06 },
    { hints: LOCKOUT, duration: 1.15, hold: 0.28 },
    { hints: DIP, duration: 0.85, hold: 0.08 },
  ],
  checks: () => [
    checkFlatBack("Keep the lower back near neutral through the dip and the press."),
    checkFeetPlanted("Keep the soles of the feet down through the dip."),
    checkJointRange(
      "knee-dip",
      "Knees dip before the drive",
      "Bend the knees in a quarter squat while the working arm stays quiet.",
      "knee_L.flex",
      18,
    ),
    checkJointWithinAt(
      "dip-depth",
      "Quarter-squat dip",
      "The dip is a shallow knee bend with the chest up.",
      "knee_L.flex",
      "peak",
      22,
      55,
    ),
    checkJointRange(
      "elbow-locked",
      "Working elbow locks out overhead",
      "After the leg drive, straighten the working elbow overhead.",
      "elbow_L.flex",
      70,
    ),
    checkJointRange(
      "overhead-lockout",
      "Working arm finishes overhead",
      "At the top the knees, hips, and working elbow are straight.",
      "shoulder_L.elev",
      80,
    ),
  ],
});
