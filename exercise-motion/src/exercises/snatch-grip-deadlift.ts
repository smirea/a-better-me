import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Wide snatch grip: arms leave the torso at about 45 degrees and the bar sits at the hip crease when upright. */
const ARMS = {
  "shoulder.plane": 28,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 74,
  "wrist.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "snatch-grip-deadlift",
  catalogId: "1a35c6f170d88065a9ddd9ff0c4a26eb",
  name: "Snatch Grip Deadlift",
  defaultLoadKg: 22,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Floor", "Stand", "Lockout"],
  tempo: { lower: 1.7, bottom: 0.85, raise: 1.35, top: 0.45 },
  station: { kind: "standing", stanceX: 0.13, toeOutDeg: 8 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.46,
    path: { startY: 0.78, startZ: 0.22, endY: 0.25, endZ: 0.3, arcBulgeZ: 0.04 },
  },
  extraContacts: { bar: { shank_L: 0.03, shank_R: 0.03 } },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 36, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.74,
      "root.z": -0.06,
      "root.pitch": 48,
      "hip.flex": 88,
      "hip.abd": 4,
      "knee.flex": 72,
      "ankle.dorsi": 16,
      "shoulder.elev": 62,
      "lumbar.flex": 4,
      "thoracic.flex": 8,
      "neck.flex": -4,
    },
  },
  checks: () => [
    checkFlatBack(
      "While keeping your chest up and back flat with the bar close to your shins, drive through your legs.",
      18,
    ),
    checkNeutralNeck("Keep your neck near a neutral position, like when you are normally looking straight ahead."),
    checkJointRange(
      "floor-pull",
      "Hips and knees extend from the floor",
      "Drive through your legs to begin lifting the bar as you push the floor away while extending your hips and knees.",
      "knee_L.flex",
      45,
    ),
    checkJointWithinAt(
      "wide-grip",
      "Arms spread into a snatch grip",
      "Spread your arms apart with straight elbows until your arms form close to 45-degree angles with your torso.",
      "shoulder_L.elev",
      "start",
      28,
      75,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "With your hands wide apart, firmly grasp the bar with an overhand grip and straight elbows.",
      "elbow_L.flex",
      "bottom",
      0,
      18,
    ),
  ],
});
