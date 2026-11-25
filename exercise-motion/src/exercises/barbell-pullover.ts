import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { lockAngle } from "../solver";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Same bench pullover as the EZ-bar version, with a straight bar and an overhand grip. */
const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "lumbar.flex": -6,
  "thoracic.flex": -2,
  "neck.flex": 6,
  "clavicle.prot": -4,
};

const OVER_CHEST = {
  "shoulder.elev": 92,
  "shoulder.plane": 80,
  "shoulder.twist": 8,
  "elbow.flex": 20,
  "forearm.pron": 68,
  "wrist.flex": 0,
  "clavicle.elev": 4,
};

const OVERHEAD = {
  ...OVER_CHEST,
  "shoulder.elev": 158,
  "shoulder.plane": 84,
  "elbow.flex": 28,
  "clavicle.elev": 16,
};

export const spec = buildExerciseSpec({
  id: "barbell-pullover",
  catalogId: "1dc5c6f170d88089b852feeb63b0e9e2",
  name: "Barbell Pullover",
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
  apparatus: { kind: "barbell", style: "straight", gripX: 0.24 },
  stiffness: { elbow: 8, shoulder: 0.55, lumbar: 10, thoracic: 8, wrist: 3 },
  extraGoals: (body) => [lockAngle(body, "elbow_L.flex", 24, 10), lockAngle(body, "elbow_R.flex", 24, 10)],
  hints: {
    start: { ...TRUNK, ...OVER_CHEST },
    end: { ...TRUNK, ...OVERHEAD },
  },
  checks: () => [
    checkFeetPlanted("Once you are lying down, keep both feet on the ground with your knees bent."),
    checkFlatBack(
      "Keep your lower back near a neutral position and avoid excessively arching it during the descent.",
      14,
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip",
      "Grasp the bar with an approximately shoulder-width overhand grip so the palms face back toward you.",
      "forearm_L.pron",
      "top",
      45,
      90,
    ),
    checkJointWithinAt(
      "soft-elbows",
      "Elbows stay fairly straight",
      "Avoid meaningfully bending the elbows. A mild bend is fine as the shoulders move.",
      "elbow_L.flex",
      "peak",
      6,
      42,
    ),
    checkJointWithinAt(
      "overhead",
      "Bar finishes behind the head",
      "Lower the bar in an arc until the upper arms are close to parallel with the ground.",
      "shoulder_L.elev",
      "bottom",
      130,
      175,
    ),
    checkJointRange(
      "shoulder-extension",
      "Shoulders sweep the bar back over the chest",
      "Pull the arms upward and forward until they point straight up toward the ceiling.",
      "shoulder_L.elev",
      45,
    ),
  ],
});
