import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Athletic dip-and-drive on plate-loaded jammer arms that travel up and forward. */
const ARMS_RACK = {
  "clavicle.elev": 6,
  "clavicle.prot": -2,
  "shoulder.elev": 62,
  "shoulder.plane": 80,
  "shoulder.twist": 8,
  "elbow.flex": 92,
  "forearm.pron": 16,
  "wrist.flex": 2,
};

const ARMS_LOCK = {
  "clavicle.elev": 18,
  "clavicle.prot": 0,
  "shoulder.elev": 156,
  "shoulder.plane": 40,
  "shoulder.twist": 2,
  "elbow.flex": 10,
  "forearm.pron": 14,
  "wrist.flex": 0,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "lumbar.flex": -2,
  "hip.flex": 6,
  "knee.flex": 6,
  "ankle.dorsi": 2,
  "neck.flex": 6,
  ...ARMS_RACK,
};

const DIP = {
  ...STAND,
  "root.y": 0.84,
  "root.pitch": 8,
  "hip.flex": 30,
  "knee.flex": 36,
  "ankle.dorsi": 14,
};

const LOCKOUT = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "lumbar.flex": -2,
  "hip.flex": 4,
  "knee.flex": 4,
  "ankle.dorsi": 2,
  "neck.flex": 2,
  ...ARMS_LOCK,
};

export const spec = buildExerciseSpec({
  id: "jammer-push-press",
  catalogId: "33e5c6f170d8801a99a6da686f7fbf63",
  name: "Jammer Push Press",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Dip", "Drive", "Lower", "Rack"],
  loopMode: "cycle",
  station: { kind: "standing", stanceX: 0.18, heelZ: 0.08, toeOutDeg: 10, trackKnees: 8, balanceZ: 0.1 },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    anchor: "press",
    forceDir: [0, 0.9, 0.25],
  },
  hints: { start: STAND, end: LOCKOUT },
  waypoints: [
    { hints: STAND, duration: 0.45, hold: 0.18 },
    { hints: DIP, duration: 0.4, hold: 0.06 },
    { hints: LOCKOUT, duration: 1.35, hold: 0.3 },
    { hints: DIP, duration: 0.8, hold: 0.08 },
  ],
  checks: () => [
    checkFlatBack("Keep the torso fairly upright through the dip. Do not turn the drive into a back bend."),
    checkFeetPlanted("Keep the feet planted. The dip is a quarter squat with the whole sole on the floor."),
    checkJointRange(
      "knee-dip",
      "Knees dip before the drive",
      "Dip by bending the knees, then drive the jammer arms up and forward as the legs straighten.",
      "knee_L.flex",
      18,
    ),
    checkJointWithinAt(
      "dip-depth",
      "Quarter-squat dip",
      "The dip is shallow. Track the knees forward, not inward.",
      "knee_L.flex",
      "peak",
      22,
      55,
    ),
    checkJointRange(
      "elbows-locked",
      "Elbows lock out on the drive",
      "After the leg drive, straighten the elbows as the arms travel diagonally up and forward.",
      "elbow_L.flex",
      65,
    ),
    checkJointRange(
      "shoulder-drive",
      "Arms finish up the jammer arc",
      "Finish with the hips and knees straight and the handles up and in front of the shoulders.",
      "shoulder_L.elev",
      55,
    ),
  ],
});
