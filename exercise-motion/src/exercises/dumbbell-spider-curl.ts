import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/**
 * Chest-supported curl. A face-down adjustable bench does not seat the torso on
 * the pad in this solver, so this uses the elevated flat bench the other
 * chest-supported rows use, with the arms hanging and only the elbows moving.
 */
const TRUNK = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.86,
  "root.z": -0.16,
  "root.pitch": 80,
  "hip.flex": 8,
  "hip.abd": 12,
  "knee.flex": 10,
  "ankle.dorsi": 6,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": -8,
};

const ARMS = {
  "shoulder.elev": 72,
  "shoulder.plane": 86,
  "shoulder.twist": -8,
  "forearm.pron": -76,
  "wrist.flex": 2,
  "clavicle.elev": 4,
  "clavicle.prot": 2,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-spider-curl",
  catalogId: "1a15c6f170d880799ba1f1b6157da5f6",
  name: "Dumbbell Spider Curl",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Hang"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.35 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "down",
    benchTopY: 0.78,
    feetOnFloor: false,
  },
  stiffness: { lumbar: 12, thoracic: 10, shoulder: 1.1, elbow: 2.2 },
  apparatus: { kind: "dumbbells" },
  hints: {
    start: { ...TRUNK, ...ARMS, "elbow.flex": 12 },
    end: { ...TRUNK, ...ARMS, "elbow.flex": 124 },
  },
  checks: () => [
    checkFlatBack(
      "Keep your chest on the bench. While your forearms move, the rest of your body stays still.",
    ),
    checkJointWithinAt(
      "elbows-extended",
      "Arms hang with straight elbows",
      "Start with your arms hanging straight down toward the ground and your elbows straight.",
      "elbow_L.flex",
      "top",
      0,
      30,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows fully flex at the peak",
      "Curl the dumbbells upward until your elbows are fully bent.",
      "elbow_L.flex",
      "bottom",
      100,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Spider curl",
      "Keep your upper arms directed straight down and curl by bending your elbows, then lower until the elbows are straight again.",
      "elbow_L.flex",
      75,
    ),
    {
      id: "upper-arms-down",
      label: "Upper arms stay hanging",
      cue: "Keep your upper arms directed straight down. Avoid swinging your elbows forward.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["shoulder_L.elev"]) - 72), 16, "° of upper-arm swing"),
    },
    {
      id: "underhand-grip",
      label: "Underhand grip held throughout",
      cue: "Direct your palms to face forward and keep that underhand grip for the whole set.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -48, "° of forearm pronation"),
    },
  ],
});
