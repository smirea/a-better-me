import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Supine on the floor, both hands on one kettlebell, short arc overhead toward the mat. */
const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "root.y": 0.2,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "neck.flex": 4,
  "hip.flex": 36,
  "knee.flex": 78,
  "clavicle.prot": 0,
};

const OVER_CHEST = {
  "shoulder.elev": 72,
  "shoulder.plane": 28,
  "shoulder.twist": 0,
  "elbow.flex": 18,
  "forearm.pron": 8,
  "wrist.flex": 0,
  "clavicle.elev": 4,
};

const TO_FLOOR = {
  ...OVER_CHEST,
  "shoulder.elev": 82,
  "elbow.flex": 22,
  "clavicle.elev": 10,
};

export const spec = buildExerciseSpec({
  id: "floor-kettlebell-pullover",
  catalogId: "3e65c6f170d8801392abdbee8ec6b254",
  name: "Floor Kettlebell Pullover",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Toward floor", "Pull", "Over chest"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.4, top: 0.3 },
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    stanceX: 0.18,
    heelZ: 0.55,
    feetOnFloor: true,
  },
  apparatus: { kind: "kettlebells", twoHandsOnOne: true },
  stiffness: { elbow: 8, shoulder: 0.6, lumbar: 10 },
  extraGoals: (body) => [lockAngle(body, "elbow_L.flex", 24, 10), lockAngle(body, "elbow_R.flex", 24, 10)],
  hints: {
    start: { ...TRUNK, ...OVER_CHEST },
    end: { ...TRUNK, ...TO_FLOOR },
  },
  checks: () => [
    checkFlatBack(
      "Lie supine on the mat and keep the ribs down so the lower back does not peel into a deep arch.",
      14,
    ),
    checkJointWithinAt(
      "soft-elbows",
      "Elbows stay softly bent",
      "Hold the kettlebell with both hands and keep a slight bend in the elbows.",
      "elbow_L.flex",
      "peak",
      8,
      42,
    ),
    checkJointWithinAt(
      "over-chest",
      "Bell starts over the chest",
      "Start with the arms up over the chest, bell held in both hands.",
      "shoulder_L.elev",
      "top",
      45,
      120,
    ),
    checkJointRange(
      "shoulder-extension",
      "Kettlebell arcs overhead toward the floor and back",
      "Sweep the bell overhead toward the mat, then pull it back over the chest. The floor shortens the range.",
      "shoulder_L.elev",
      12,
    ),
  ],
});
