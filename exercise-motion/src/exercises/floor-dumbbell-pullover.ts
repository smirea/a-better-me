import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/**
 * Supine on the floor. The mat stops the bell, so the arc is shorter than a bench pullover:
 * arms over the chest down toward the floor overhead, then back.
 */
const TRUNK = {
  ...POSTURE_HINTS.supineFloor,
  "hip.flex": 40,
  "knee.flex": 70,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "neck.flex": 4,
  "clavicle.prot": 0,
};

const OVER_CHEST = {
  "shoulder.elev": 86,
  "shoulder.plane": 78,
  "shoulder.twist": 10,
  "elbow.flex": 22,
  "forearm.pron": 6,
  "wrist.flex": 2,
  "clavicle.elev": 4,
};

const TO_FLOOR = {
  ...OVER_CHEST,
  "shoulder.elev": 118,
  "elbow.flex": 26,
  "clavicle.elev": 12,
};

export const spec = buildExerciseSpec({
  id: "floor-dumbbell-pullover",
  catalogId: "3e65c6f170d8802eb00fc933fbbddb60",
  name: "Floor Dumbbell Pullover",
  defaultLoadKg: 12,
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
  apparatus: { kind: "dumbbells" },
  stiffness: { elbow: 8, shoulder: 0.6, lumbar: 10 },
  extraGoals: (body) => [lockAngle(body, "elbow_L.flex", 24, 10), lockAngle(body, "elbow_R.flex", 24, 10)],
  hints: {
    start: { ...TRUNK, ...OVER_CHEST },
    end: { ...TRUNK, ...TO_FLOOR },
  },
  checks: () => [
    checkFlatBack(
      "Lie on the mat with the lower back near neutral. The floor limits how far the bell can travel overhead.",
      14,
    ),
    checkJointWithinAt(
      "soft-elbows",
      "Elbows stay softly bent",
      "Hold the dumbbell with both hands and keep a slight elbow bend while the shoulders move.",
      "elbow_L.flex",
      "peak",
      8,
      42,
    ),
    checkJointWithinAt(
      "over-chest",
      "Bell starts over the chest",
      "Begin with the arms directed up over the chest.",
      "shoulder_L.elev",
      "top",
      70,
      115,
    ),
    checkJointWithinAt(
      "toward-floor",
      "Bell arcs overhead toward the floor",
      "Lower the bell in an arc overhead until it nears the floor, then pull it back over the chest.",
      "shoulder_L.elev",
      "bottom",
      110,
      150,
    ),
    checkJointRange(
      "shoulder-extension",
      "Shoulders extend and flex over a short floor arc",
      "The mat stops the dumbbell before the upper arms reach parallel, which is the point of this variation.",
      "shoulder_L.elev",
      25,
    ),
  ],
});
