import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": -6,
  "lumbar.flex": -6,
  "thoracic.flex": -4,
  "neck.flex": 8,
  "hip.flex": 86,
  "knee.flex": 88,
};

const WORK_BOTTOM = {
  "clavicle.elev": 8,
  "clavicle.prot": -6,
  "shoulder.elev": 76,
  "shoulder.plane": 58,
  "shoulder.twist": 12,
  "elbow.flex": 96,
  "forearm.pron": 68,
  "wrist.flex": 6,
};

const WORK_TOP = {
  "clavicle.elev": 16,
  "clavicle.prot": 2,
  "shoulder.elev": 166,
  "shoulder.plane": 22,
  "shoulder.twist": 6,
  "elbow.flex": 8,
  "forearm.pron": 64,
  "wrist.flex": 4,
};

const REST = {
  "clavicle.elev": 2,
  "clavicle.prot": 0,
  "shoulder.elev": 10,
  "shoulder.plane": 18,
  "shoulder.twist": 4,
  "elbow.flex": 14,
  "forearm.pron": 8,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "seated-single-arm-dumbbell-overhead-press",
  catalogId: "1a05c6f170d880f8b599f462f33ccd94",
  name: "Seated Single Arm Dumbbell Overhead Press",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Shoulder"],
  tempo: { lower: 1.15, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.43,
    stanceX: 0.18,
    heelZ: 0.36,
    pinHead: false,
    frame: { type: "adjustable-bench", backAngleDeg: 82 },
  },
  apparatus: { kind: "dumbbells", sides: ["L"], anchor: "press" },
  hints: {
    start: sidedHints("L", WORK_BOTTOM, REST, { ...SEAT, "neck.flex": 12 }),
    end: sidedHints("L", WORK_TOP, REST, { ...SEAT, "neck.flex": -2 }),
  },
  extraContacts: {
    "bench.backPad": { head: 0.08, neck: 0.06, girdle: 0.04, chest: 0.04 },
  },
  checks: () => [
    checkFlatBack("Keep the hips against the bench and the lower back in its natural curve."),
    checkFeetPlanted("Keep the feet flat and the buttocks, upper back, and head on the bench."),
    checkJointWithinAt(
      "bell-at-shoulder",
      "Dumbbell starts beside the shoulder",
      "Lower until the working elbow is below the shoulder with the forearm vertical.",
      "elbow_L.flex",
      "start",
      75,
      120,
    ),
    checkJointWithinAt(
      "elbow-locked",
      "Working elbow locked overhead",
      "Press until the working elbow is fully straightened.",
      "elbow_L.flex",
      "peak",
      0,
      30,
    ),
    checkJointWithinAt(
      "overhead-lockout",
      "Working arm finishes overhead",
      "The dumbbell finishes vertically over the working shoulder.",
      "shoulder_L.elev",
      "peak",
      135,
      175,
    ),
    checkAnchorTravel("bell-rises", "Dumbbell travels upward", "Press the dumbbell from the shoulder to overhead.", "press_L", "y", 0.32),
    checkJointRange("shoulder-rom", "Working shoulder presses through a full arc", "Primary joint action is shoulder abduction.", "shoulder_L.elev", 60),
  ],
});
