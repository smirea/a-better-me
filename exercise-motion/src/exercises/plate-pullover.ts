import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Plate pinched between the palms, same bench arc as a dumbbell pullover. */
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
  "elbow.flex": 20,
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
  id: "plate-pullover",
  catalogId: "2085c6f170d880959b7ef4d14f58c269",
  name: "Plate Pullover",
  defaultLoadKg: 10,
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
  apparatus: { kind: "plate", twoHandsOnOne: true },
  stiffness: { elbow: 8, shoulder: 0.55, lumbar: 10, thoracic: 8 },
  extraGoals: (body) => [lockAngle(body, "elbow_L.flex", 24, 10), lockAngle(body, "elbow_R.flex", 24, 10)],
  hints: {
    start: { ...TRUNK, ...OVER_CHEST },
    end: { ...TRUNK, ...OVERHEAD },
  },
  checks: () => [
    checkFeetPlanted("Keep both feet on the ground with the knees bent."),
    checkFlatBack(
      "Keep the lower back near a standing-neutral position while the plate travels behind the head.",
      14,
    ),
    checkJointWithinAt(
      "palms-in",
      "Palms face each other on the plate",
      "Hold the plate with both hands, palms in toward each other.",
      "forearm_L.pron",
      "top",
      -20,
      30,
    ),
    checkJointWithinAt(
      "soft-elbows",
      "Elbows stay fairly straight",
      "A mild elbow bend is fine. Do not turn the pullover into a skull crusher.",
      "elbow_L.flex",
      "peak",
      6,
      42,
    ),
    checkJointRange(
      "shoulder-extension",
      "Plate arcs behind the head and back over the chest",
      "Lower through the shoulder range you can stretch safely, then pull the arms back toward the ceiling.",
      "shoulder_L.elev",
      45,
    ),
  ],
});
