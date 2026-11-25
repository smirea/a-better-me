import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";

/**
 * 45° incline. Arms hang externally rotated so the biceps face out to the sides.
 * The grip does not rotate; only the elbows flex.
 */
const ARMS = {
  "shoulder.elev": 24,
  "shoulder.plane": -6,
  "shoulder.twist": -68,
  "forearm.pron": -76,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -8,
};

export const spec = buildExerciseSpec({
  id: "incline-externally-rotated-dumbbell-biceps-curl",
  catalogId: "2ab5c6f170d88035b91be4763b499231",
  name: "Incline Externally Rotated Dumbbell Biceps Curl",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Rest"],
  tempo: { lower: 1.5, bottom: 0.35, raise: 1.9, top: 0.4 },
  station: {
    kind: "seated",
    seatY: 0.43,
    stanceX: 0.24,
    heelZ: 0.42,
    frame: { type: "adjustable-bench", backAngleDeg: 45 },
  },
  apparatus: { kind: "dumbbells" },
  hints: {
    start: { ...POSTURE_HINTS.incline45, ...ARMS, "elbow.flex": 16 },
    end: { ...POSTURE_HINTS.incline45, ...ARMS, "elbow.flex": 128 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.2, -0.24, -0.02], 36, "xyz"),
    holdElbowNearShoulder(body, "R", [0.2, -0.24, -0.02], 36, "xyz"),
  ],
  extraContacts: {
    "bench.backPad": { pelvis: 0.05, abdomen: 0.04, girdle: 0.045, chest: 0.04 },
    "bench.seatPad": { thigh_L: 0.05, thigh_R: 0.05, thighShaft_L: 0.05, thighShaft_R: 0.05 },
  },
  checks: () => [
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start extended",
      "Sit on the incline bench with the elbows straight and the arms hanging down toward the ground.",
      "elbow_L.flex",
      "top",
      0,
      30,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows fully flex at the peak",
      "At the top of the curl, your elbows should be fully bent with your forearms touching your biceps.",
      "elbow_L.flex",
      "bottom",
      105,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow flexion curl",
      "Bend your elbows to curl the dumbbells upward, then lower them until the elbows are straight.",
      "elbow_L.flex",
      85,
    ),
    {
      id: "externally-rotated",
      label: "Arms stay externally rotated",
      cue: "Rotate the arms so the palms and the front of the biceps point out to the sides, and do not rotate them during the set.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["shoulder_L.twist"]), -40, "° short of external rotation"),
    },
    {
      id: "supinated-grip",
      label: "Supinated grip held throughout",
      cue: "Keep the palms directed out to the sides. Do not turn the forearms during the curl.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -48, "° of forearm pronation"),
    },
  ],
});
