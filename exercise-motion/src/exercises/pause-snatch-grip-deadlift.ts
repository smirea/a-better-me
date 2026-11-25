import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Wide snatch grip; the hold is just off the floor, near mid-shin. */
const ARMS = {
  "clavicle.prot": -14,
  "shoulder.plane": 42,
  "shoulder.twist": 4,
  "elbow.flex": 5,
  "forearm.pron": 74,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "pause-snatch-grip-deadlift",
  catalogId: "2985c6f170d880079f37d8c6cfcd84cd",
  name: "Pause Snatch Grip Deadlift",
  defaultLoadKg: 16,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Pause", "Stand", "Lockout"],
  tempo: { lower: 1.4, bottom: 1.6, raise: 1.2, top: 0.4 },
  station: { kind: "standing", stanceX: 0.14, toeOutDeg: 8 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.44,
    path: { startY: 0.82, startZ: 0.16, endY: 0.4, endZ: 0.22, arcBulgeZ: 0.04 },
  },
  extraContacts: { bar: { shank_L: 0.03, shank_R: 0.03, thigh_L: 0.03, thigh_R: 0.03 } },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 18, "hip.abd": 6, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.8,
      "root.z": -0.08,
      "root.pitch": 52,
      "hip.flex": 74,
      "hip.abd": 6,
      "knee.flex": 42,
      "ankle.dorsi": 12,
      "shoulder.elev": 28,
      "lumbar.flex": 5,
      "thoracic.flex": 8,
      "neck.flex": -4,
    },
  },
  checks: () => [
    checkFlatBack(
      "After the bar reaches near the middle of your shins, pause while staying tight with your chest up and back flat.",
      18,
    ),
    checkNeutralNeck("Keep your neck near neutral and your chest up through the pause."),
    checkJointRange(
      "snatch-pull",
      "Wide-grip pull to mid-shin",
      "Spread your arms apart until they form close to 45-degree angles with your torso, then pull from the floor.",
      "hip_L.flex",
      42,
    ),
    checkJointWithinAt(
      "mid-shin-pause",
      "Pause with the hips still flexed",
      "Pause in that position for a brief period of time (e.g., 1-2 seconds) while staying tight.",
      "hip_L.flex",
      "bottom",
      50,
      105,
    ),
    checkJointWithinAt(
      "wide-arms",
      "Arms stay out in a snatch grip",
      "A true snatch grip places the bar level with the crease of your hip when you are fully upright.",
      "shoulder_L.elev",
      "start",
      12,
      50,
    ),
  ],
});
