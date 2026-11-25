import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { lockAngle } from "../solver";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Supine on a flat bench. Soft elbows sweep the EZ bar from over the chest to overhead. */
const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "lumbar.flex": -6,
  "thoracic.flex": -2,
  "neck.flex": 6,
  "clavicle.prot": -2,
};

const OVER_CHEST = {
  "shoulder.elev": 92,
  "shoulder.plane": 78,
  "shoulder.twist": 6,
  "elbow.flex": 22,
  "forearm.pron": 42,
  "wrist.flex": 2,
  "clavicle.elev": 4,
};

const OVERHEAD = {
  ...OVER_CHEST,
  "shoulder.elev": 158,
  "shoulder.plane": 82,
  "elbow.flex": 28,
  "clavicle.elev": 16,
};

export const spec = buildExerciseSpec({
  id: "ez-bar-pullover",
  catalogId: "2335c6f170d880098d93feb9115ee7b4",
  name: "EZ Bar Pullover",
  defaultLoadKg: 20,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Overhead", "Pull", "Over chest"],
  tempo: { lower: 2, bottom: 0.3, raise: 1.5, top: 0.35 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.2,
    heelZ: 0.42,
    feetOnFloor: true,
  },
  apparatus: { kind: "barbell", style: "ez", gripX: 0.2 },
  stiffness: { elbow: 8, shoulder: 0.55, lumbar: 10, thoracic: 8, wrist: 3 },
  extraGoals: (body) => [lockAngle(body, "elbow_L.flex", 24, 10), lockAngle(body, "elbow_R.flex", 24, 10)],
  hints: {
    start: { ...TRUNK, ...OVER_CHEST },
    end: { ...TRUNK, ...OVERHEAD },
  },
  checks: () => [
    checkFeetPlanted("Once you are lying down, keep both feet on the ground with your knees bent."),
    checkFlatBack(
      "Keep your lower back near a neutral position, like when you are normally standing upright, and avoid excessively arching it as the bar goes behind your head.",
      14,
    ),
    checkJointWithinAt(
      "soft-elbows",
      "Elbows stay softly bent",
      "Avoid meaningfully bending your elbows. A mild bend is fine while the arms move at the shoulders.",
      "elbow_L.flex",
      "peak",
      8,
      42,
    ),
    checkJointWithinAt(
      "over-chest",
      "Bar starts over the chest",
      "Start with the arms directed up toward the ceiling, as at the end of a bench press rep.",
      "shoulder_L.elev",
      "top",
      70,
      115,
    ),
    checkJointWithinAt(
      "overhead",
      "Upper arms finish near parallel with the floor",
      "Lower the bar behind the head until the upper arms are close to parallel with the ground, within a comfortable shoulder stretch.",
      "shoulder_L.elev",
      "bottom",
      130,
      175,
    ),
    checkJointRange(
      "shoulder-extension",
      "Shoulders sweep from overhead back over the chest",
      "Pull the arms upward and forward in an arc until they point at the ceiling again.",
      "shoulder_L.elev",
      45,
    ),
  ],
});
