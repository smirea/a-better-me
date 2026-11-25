import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Upright bench, elbows flared about 60–75°, palms angled forward. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": -6,
  "lumbar.flex": -6,
  "thoracic.flex": -4,
  "neck.flex": 8,
  "hip.flex": 86,
  "knee.flex": 88,
};

const ARMS_BOTTOM = {
  "clavicle.elev": 8,
  "clavicle.prot": -8,
  "shoulder.elev": 76,
  "shoulder.plane": 58,
  "shoulder.twist": 12,
  "elbow.flex": 96,
  "forearm.pron": 70,
  "wrist.flex": 6,
};

const ARMS_TOP = {
  "clavicle.elev": 16,
  "clavicle.prot": 2,
  "shoulder.elev": 166,
  "shoulder.plane": 20,
  "shoulder.twist": 6,
  "elbow.flex": 8,
  "forearm.pron": 66,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "seated-dumbbell-overhead-press",
  catalogId: "1a05c6f170d88060bbffeeb9acaa3c80",
  name: "Seated Dumbbell Overhead Press",
  defaultLoadKg: 16,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Chest"],
  tempo: { lower: 1.15, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.43,
    stanceX: 0.18,
    heelZ: 0.36,
    pinHead: false,
    frame: { type: "adjustable-bench", backAngleDeg: 82 },
  },
  apparatus: { kind: "dumbbells", anchor: "press" },
  hints: {
    start: { ...SEAT, ...ARMS_BOTTOM, "neck.flex": 12 },
    end: { ...SEAT, ...ARMS_TOP, "neck.flex": -2 },
  },
  extraContacts: {
    "bench.backPad": { head: 0.08, neck: 0.06, girdle: 0.04, chest: 0.04 },
  },
  checks: () => [
    checkFlatBack(
      "Keep the hips against the bench. Do not scoot forward or excessively arch the lower back.",
    ),
    checkFeetPlanted("Keep the feet flat and the buttocks, upper back, and head on the bench."),
    checkJointWithinAt(
      "bells-at-shoulders",
      "Dumbbells start beside the shoulders",
      "Lower until the elbows are below the shoulders with the forearms vertical.",
      "elbow_L.flex",
      "start",
      75,
      120,
    ),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked overhead",
      "Press until the elbows are fully straightened.",
      "elbow_L.flex",
      "peak",
      0,
      28,
    ),
    checkJointWithinAt(
      "overhead-lockout",
      "Arms finish overhead",
      "Drive the elbows upward and inward until the dumbbells sit over the shoulders.",
      "shoulder_L.elev",
      "peak",
      140,
      175,
    ),
    checkAnchorTravel(
      "bells-rise",
      "Dumbbells travel upward",
      "Press the dumbbells from the shoulders to overhead.",
      "press_L",
      "y",
      0.32,
    ),
    checkJointRange(
      "shoulder-rom",
      "Shoulders press through a full arc",
      "Primary joint action is shoulder abduction, with shoulder flexion.",
      "shoulder_L.elev",
      60,
    ),
  ],
});
