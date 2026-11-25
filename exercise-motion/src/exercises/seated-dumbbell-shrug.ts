import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/** Neutral-grip hang beside the bench, elbows long. The shrug is clavicle elevation. */
const ARMS_DOWN = {
  "shoulder.elev": 12,
  "shoulder.plane": 28,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 4,
  "wrist.flex": 2,
  "clavicle.elev": -6,
  "clavicle.prot": -2,
};

const ARMS_UP = {
  ...ARMS_DOWN,
  "clavicle.elev": 26,
  "shoulder.elev": 14,
};

const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": -4,
  "lumbar.flex": 0,
  "thoracic.flex": -2,
  "neck.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "seated-dumbbell-shrug",
  catalogId: "1a15c6f170d8801da273dbdc61789e83",
  name: "Seated Dumbbell Shrug",
  defaultLoadKg: 18,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Front" },
  phaseLabels: ["Shrug", "Ears", "Lower", "Stretch"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.2, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.46,
    stanceX: 0.22,
    heelZ: 0.42,
    frame: { type: "adjustable-bench", backAngleDeg: 82 },
  },
  apparatus: { kind: "dumbbells" },
  stiffness: { elbow: 6, shoulder: 2.4, clavicle: 0.45, lumbar: 7, knee: 4 },
  hints: {
    start: { ...SEAT, ...ARMS_DOWN },
    end: { ...SEAT, ...ARMS_UP },
  },
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "clavicle_L.elev", -6, 48),
      lockAngle(body, "clavicle_R.elev", -6, 48),
      lockAngle(body, "elbow_L.flex", 8, 30),
      lockAngle(body, "elbow_R.flex", 8, 30),
    ],
    end: [
      lockAngle(body, "clavicle_L.elev", 26, 48),
      lockAngle(body, "clavicle_R.elev", 26, 48),
      lockAngle(body, "elbow_L.flex", 8, 30),
      lockAngle(body, "elbow_R.flex", 8, 30),
    ],
  }),
  extraContacts: {
    "bench.backPad": { pelvis: 0.05, abdomen: 0.04, girdle: 0.045 },
    "bench.seatPad": { thigh_L: 0.05, thigh_R: 0.05, thighShaft_L: 0.05, thighShaft_R: 0.05 },
  },
  checks: () => [
    checkFlatBack("Sit tall with the lower back near neutral and the feet flat on the floor.", 16),
    checkNeutralNeck("Keep the neck neutral, as when you are looking straight ahead."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay extended",
      "Hold the dumbbells at your sides with extended elbows and palms facing in.",
      "elbow_L.flex",
      "peak",
      0,
      18,
    ),
    checkJointWithinAt(
      "shoulders-up",
      "Shoulders finish elevated",
      "Shrug the shoulders up toward the ears through the available range.",
      "clavicle_L.elev",
      "peak",
      16,
      34,
    ),
    checkJointRange(
      "shrug-rom",
      "Scapulae elevate and depress",
      "Lower the shoulders a little below resting height, then shrug them straight up.",
      "clavicle_L.elev",
      20,
    ),
  ],
});
