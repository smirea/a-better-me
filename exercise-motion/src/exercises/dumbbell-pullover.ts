import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/**
 * Both hands cup one dumbbell over the chest (diamond grip). The builder has no
 * two-hands-on-one dumbbell, so one bell is shared by pinning the hands together.
 */
const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "lumbar.flex": -6,
  "thoracic.flex": -2,
  "neck.flex": 6,
  "clavicle.prot": 0,
};

const OVER_CHEST = {
  "shoulder.elev": 90,
  "shoulder.plane": 86,
  "shoulder.twist": 4,
  "elbow.flex": 22,
  "forearm.pron": 6,
  "wrist.flex": 2,
  "clavicle.elev": 4,
};

const OVERHEAD = {
  ...OVER_CHEST,
  "shoulder.elev": 156,
  "elbow.flex": 28,
  "clavicle.elev": 16,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-pullover",
  catalogId: "1a15c6f170d8808b9721ff65d549d8ba",
  name: "Dumbbell Pullover",
  defaultLoadKg: 14,
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
  apparatus: { kind: "dumbbells" },
  stiffness: { elbow: 8, shoulder: 0.55, lumbar: 10, thoracic: 8 },
  extraGoals: (body) => [lockAngle(body, "elbow_L.flex", 24, 10), lockAngle(body, "elbow_R.flex", 24, 10)],
  hints: {
    start: { ...TRUNK, ...OVER_CHEST },
    end: { ...TRUNK, ...OVERHEAD },
  },
  checks: () => [
    checkFeetPlanted("Keep both feet on the ground with the knees bent once you are lying down."),
    checkFlatBack(
      "Keep the lower back near the standing-neutral curve. Do not flare the ribs as the bell goes behind the head.",
      14,
    ),
    checkJointWithinAt(
      "neutral-grip",
      "Palms cup one end of the dumbbell",
      "Both palms contact one end of the dumbbell, thumbs and index fingers crossed, handle vertical.",
      "forearm_L.pron",
      "top",
      -20,
      30,
    ),
    checkJointWithinAt(
      "soft-elbows",
      "Elbows stay softly bent",
      "Do not meaningfully bend the elbows. A mild bend is enough while the shoulders move.",
      "elbow_L.flex",
      "peak",
      8,
      42,
    ),
    checkJointRange(
      "shoulder-extension",
      "Bell arcs from over the chest to behind the head",
      "Lower until the upper arms are near parallel with the floor, then pull back over the chest.",
      "shoulder_L.elev",
      45,
    ),
  ],
});
