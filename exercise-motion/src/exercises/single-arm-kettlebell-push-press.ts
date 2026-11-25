import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** One kettlebell in the front rack. Dip, drive the legs, then punch the bell overhead. */
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
  "shoulder.elev": 150,
  "shoulder.plane": 30,
  "shoulder.twist": 2,
  "elbow.flex": 6,
  "forearm.pron": 52,
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

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 3,
  "lumbar.flex": -2,
  "hip.flex": 5,
  "knee.flex": 5,
  "ankle.dorsi": 2,
  "neck.flex": 6,
};

const DIP = {
  ...STAND,
  "root.y": 0.84,
  "hip.flex": 28,
  "knee.flex": 34,
  "ankle.dorsi": 14,
  "neck.flex": 10,
};

export const spec = buildExerciseSpec({
  id: "single-arm-kettlebell-push-press",
  catalogId: "2cf5c6f170d8805498c1ec358b498bbc",
  name: "Single Arm Kettlebell Push Press",
  defaultLoadKg: 4,
  loadUnit: "total",
  laterality: "asymmetrical",
  activeSide: "L",
  grip: "press",
  phaseLabels: ["Dip", "Drive", "Lower", "Rack"],
  loopMode: "cycle",
  station: { kind: "standing", stanceX: 0.22, heelZ: 0.12, toeOutDeg: 12, trackKnees: 8, balanceZ: 0.16 },
  apparatus: { kind: "kettlebells", sides: ["L"], hangVertical: false },
  hints: {
    start: sidedHints("L", RACK, FREE, STAND),
    end: sidedHints("L", LOCK, FREE, { ...STAND, "neck.flex": -2 }),
  },
  waypoints: [
    { hints: sidedHints("L", RACK, FREE, STAND), duration: 0.4, hold: 0.16 },
    { hints: sidedHints("L", RACK, FREE, DIP), duration: 0.4, hold: 0.06 },
    { hints: sidedHints("L", LOCK, FREE, { ...STAND, "neck.flex": -2 }), duration: 1.15, hold: 0.28 },
    { hints: sidedHints("L", RACK, FREE, DIP), duration: 0.75, hold: 0.08 },
  ],
  checks: () => [
    checkFlatBack("Keep the lower back near neutral. Do not arch to finish the press."),
    checkFeetPlanted("Keep the soles on the floor through the dip. The drive is a jump that does not leave the ground."),
    checkJointRange(
      "knee-dip",
      "Knees dip before the drive",
      "Dip in a quarter squat with the arm quiet, then extend the knees and hips to drive the bell up.",
      "knee_L.flex",
      18,
    ),
    checkJointWithinAt(
      "dip-depth",
      "Quarter-squat dip",
      "The dip is shallow, with the knees tracking toward the toes.",
      "knee_L.flex",
      "peak",
      22,
      55,
    ),
    checkJointRange(
      "elbows-locked",
      "Elbow locks out overhead",
      "After the leg drive, straighten the elbow with the bell over the shoulder and the palm forward.",
      "elbow_L.flex",
      65,
    ),
    checkJointRange(
      "overhead",
      "Arm finishes overhead",
      "At the top the knee, hip, and elbow are straight and the arm points at the ceiling.",
      "shoulder_L.elev",
      75,
    ),
  ],
});
