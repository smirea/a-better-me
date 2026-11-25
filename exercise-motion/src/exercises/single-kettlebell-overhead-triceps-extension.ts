import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Both hands on one bell's horns, upper arms vertical beside the head. */
const ARMS = {
  "shoulder.elev": 158,
  "shoulder.plane": 72,
  "shoulder.twist": 8,
  "forearm.pron": 6,
  "wrist.flex": 2,
  "clavicle.elev": 12,
  "clavicle.prot": 2,
};

export const spec = buildExerciseSpec({
  id: "single-kettlebell-overhead-triceps-extension",
  catalogId: "1a15c6f170d880d4a3b4c7727ede7730",
  name: "Single Kettlebell Overhead Triceps Extension",
  defaultLoadKg: 12,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Press", "Lockout", "Lower", "Behind head"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.4, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: { kind: "kettlebells", twoHandsOnOne: true },
  stiffness: { elbow: 4, shoulder: 2.4, lumbar: 8, thoracic: 7 },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "elbow.flex": 128, "neck.flex": 8 },
    end: { ...POSTURE_HINTS.standing, ...ARMS, "elbow.flex": 6, "shoulder.elev": 164, "neck.flex": 2 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.07, 0.02, 0.02], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.07, 0.02, 0.02], 16, "xz"),
  ],
  checks: () => [
    checkFlatBack(
      "Keep the lower back and neck near neutral, the way you stand looking straight ahead.",
    ),
    checkJointWithinAt(
      "elbows-bent",
      "Bell lowers behind the head",
      "Bend the elbows to lower the kettlebell behind the head while the upper arms stay vertical.",
      "elbow_L.flex",
      "top",
      100,
      150,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows lock overhead",
      "Finish with the elbows fully straightened and the bell overhead.",
      "elbow_L.flex",
      "bottom",
      0,
      22,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows extend overhead",
      "All the motion comes from the forearms hinging at the elbows.",
      "elbow_L.flex",
      90,
    ),
    {
      id: "neutral-grip",
      label: "Palms face in on the horns",
      cue: "Grip the horns with the palms facing in toward each other and the wrists fairly straight.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["forearm_L.pron"])), 28, "° from neutral"),
    },
  ],
});
