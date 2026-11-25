import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const LOADED = {
  "shoulder.plane": 34,
  "shoulder.twist": 6,
  "elbow.flex": 5,
  "forearm.pron": 48,
  "wrist.flex": 4,
};
const FREE_ARM = {
  "shoulder.plane": 16,
  "shoulder.twist": -8,
  "elbow.flex": 18,
  "forearm.pron": 16,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "b-stance-offset-dumbbell-romanian-deadlift",
  catalogId: "2ee5c6f170d88076931cd5574a882f38",
  name: "B-Stance Offset Dumbbell Romanian Deadlift",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "asymmetrical",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Hinge", "Stretch", "Stand", "Stacked"],
  tempo: { lower: 2.2, bottom: 0.25, raise: 1.5, top: 0.65 },
  station: {
    kind: "standing",
    stanceX: 0.12,
    toeOutDeg: 6,
    split: { frontSide: "L", frontZ: 0.04, rearZ: -0.22, rearMode: "toe", rearY: 0.02 },
  },
  apparatus: { kind: "dumbbells", sides: ["R"] },
  hints: {
    start: sidedHints("L", { "hip.flex": 4, "knee.flex": 6, ...FREE_ARM, "shoulder.elev": 12 }, { "hip.flex": 12, "knee.flex": 16, "ankle.dorsi": -8, ...LOADED, "shoulder.elev": 12 }, {
      ...POSTURE_HINTS.standing,
      "root.z": 0,
      "neck.flex": 0,
    }),
    end: sidedHints(
      "L",
      { "hip.flex": 76, "knee.flex": 20, "ankle.dorsi": 2, ...FREE_ARM, "shoulder.elev": 26 },
      { "hip.flex": 58, "knee.flex": 30, "ankle.dorsi": -12, ...LOADED, "shoulder.elev": 52 },
      {
        ...POSTURE_HINTS.standing,
        "root.y": 0.86,
        "root.z": -0.08,
        "root.pitch": 56,
        "hip.abd": 2,
        "neck.flex": -6,
        "lumbar.flex": 3,
        "thoracic.flex": 4,
      },
    ),
  },
  checks: () => [
    checkFlatBack(
      "Keep your lower back flat and your shoulders level so the offset dumbbell does not twist your torso.",
    ),
    checkNeutralNeck(
      "Keep your neck near a neutral position, as when you are standing upright and looking straight ahead.",
    ),
    checkJointRange(
      "lead-hinge",
      "Lead hip opposite the dumbbell hinges",
      "Train the leg opposite the dumbbell, sitting that hip back while the rear toes only balance you.",
      "hip_L.flex",
      45,
    ),
    checkJointWithinAt(
      "soft-lead-knee",
      "Lead knee bends only mildly",
      "Keep the lead shin close to vertical, with weight through the whole lead foot.",
      "knee_L.flex",
      "bottom",
      6,
      34,
    ),
    checkJointWithinAt(
      "rear-toe",
      "Rear foot stays on the toe",
      "Place the balls and toes of the rear foot down and keep the heel off the ground.",
      "knee_R.flex",
      "bottom",
      14,
      70,
    ),
  ],
});
