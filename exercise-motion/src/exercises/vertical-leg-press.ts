import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Supine on a horizontal pad, pressing a vertical sled straight up with the feet. */
const SUPINE = {
  "root.y": 0.14,
  "root.z": -0.05,
  "root.pitch": -86,
  "hip.abd": 10,
  "hip.rot": 6,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 4,
  "clavicle.elev": 2,
  "shoulder.elev": 16,
  "shoulder.plane": 20,
  "shoulder.twist": 8,
  "elbow.flex": 30,
  "forearm.pron": 20,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "vertical-leg-press",
  catalogId: "2fe5c6f170d880ffb230ffceb58e711c",
  name: "Vertical Leg Press",
  defaultLoadKg: 24,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 2, bottom: 0.3, raise: 1.5, top: 0.4 },
  station: { kind: "lying", surface: "floor", face: "up", feetOnFloor: false },
  apparatus: { kind: "leg-press-sled", angleDeg: 90, anchor: "ball" },
  stiffness: { knee: 3.4, hip: 2.4, ankle: 1.4, lumbar: 6 },
  hints: {
    start: { ...SUPINE, "hip.flex": 72, "knee.flex": 12, "ankle.dorsi": 4 },
    end: { ...SUPINE, "hip.flex": 112, "knee.flex": 108, "ankle.dorsi": 16 },
  },
  checks: () => [
    checkFlatBack("Keep the back flat on the horizontal pad. Do not let the hips roll up off it."),
    checkNeutralNeck("Keep the neck near neutral on the pad, looking up toward the sled."),
    checkJointWithinAt(
      "knees-straight",
      "Legs press nearly straight up",
      "Press the sled vertically until the knees are straight or only slightly bent.",
      "knee_L.flex",
      "start",
      2,
      24,
    ),
    checkJointWithinAt(
      "depth",
      "Knees lower toward the chest",
      "Lower the sled by bending the hips and knees until the thighs approach the torso.",
      "knee_L.flex",
      "peak",
      90,
      130,
    ),
    checkJointRange(
      "knee-rom",
      "Vertical sled travel",
      "The feet stay on the plate and drive it straight up, then control it back down.",
      "knee_L.flex",
      70,
    ),
  ],
});
